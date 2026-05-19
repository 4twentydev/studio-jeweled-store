"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createProductDraft, generateSku, generateSlug, updateProductStatus } from "@/db/products";
import { getPrimaryImage, getProductById, upsertAppSetting } from "@/db/queries";
import { studioSettingsSchema } from "@/db/validators";
import { generateProductIntelligence } from "@/lib/ai";
import { assertFeatureEnabled } from "@/lib/env";
import { publishToStorefront } from "@/lib/storefront";
import { uploadFileToBlob, uploadStyledBufferToBlob } from "@/lib/blob";

const captureSchema = z.object({
  titleHint: z.string().trim().min(2),
  notes: z.string().trim().min(10),
  materials: z.string().trim().min(2),
  quantityOnHand: z.coerce.number().int().min(0),
  targetPrice: z.coerce.number().min(0),
  image: z.instanceof(File)
});

export async function ingestProductCapture(_: unknown, formData: FormData) {
  const parsed = captureSchema.safeParse({
    titleHint: formData.get("titleHint"),
    notes: formData.get("notes"),
    materials: formData.get("materials"),
    quantityOnHand: formData.get("quantityOnHand"),
    targetPrice: formData.get("targetPrice"),
    image: formData.get("image")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid submission."
    };
  }

  assertFeatureEnabled("database");
  assertFeatureEnabled("blob");
  assertFeatureEnabled("openai");

  const { image, titleHint, notes, materials, quantityOnHand, targetPrice } = parsed.data;
  const originalUpload = await uploadFileToBlob(image, "originals");
  const intelligence = await generateProductIntelligence({
    titleHint,
    notes,
    materials,
    targetPrice,
    imageFile: image
  });

  const styledUpload = intelligence.styledImageBuffer
    ? await uploadStyledBufferToBlob(
        `${generateSlug(intelligence.metadata.title || titleHint)}.png`,
        intelligence.styledImageBuffer,
        intelligence.styledImageContentType
      )
    : originalUpload;

  const images = [
    {
      originalUrl: originalUpload.url,
      processedUrl: null,
      altText: intelligence.metadata.title || titleHint,
      isPrimary: !intelligence.styledImageBuffer,
      imageKind: "original" as const
    },
    ...(intelligence.styledImageBuffer
      ? [
          {
            originalUrl: originalUpload.url,
            processedUrl: styledUpload.url,
            thumbnailUrl: styledUpload.url,
            altText: intelligence.metadata.title || titleHint,
            isPrimary: true,
            imageKind: "processed" as const
          }
        ]
      : [])
  ];

  const product = await createProductDraft({
    sku: intelligence.metadata.sku || generateSku(titleHint),
    slug: `${generateSlug(intelligence.metadata.title || titleHint)}-${crypto.randomUUID().slice(0, 6).toLowerCase()}`,
    title: intelligence.metadata.title || titleHint,
    description: intelligence.metadata.description,
    shortDescription: intelligence.metadata.merchandisingNotes.slice(0, 180),
    category: intelligence.metadata.category,
    subcategory: intelligence.metadata.collection,
    price: targetPrice,
    quantity: quantityOnHand,
    status: "review",
    condition: "handmade",
    materials: intelligence.metadata.materials.length ? intelligence.metadata.materials : [materials],
    colors: intelligence.metadata.colorTone ? [intelligence.metadata.colorTone] : [],
    tags: [
      ...intelligence.metadata.tags,
      intelligence.metadata.finish,
      intelligence.metadata.dimensions
    ].filter(Boolean),
    aiConfidence: intelligence.metadata.confidence,
    aiNotes: `${intelligence.metadata.merchandisingNotes}\n\nCapture notes: ${notes}`,
    images,
    aiGeneration: {
      inputImageUrl: originalUpload.url,
      outputImageUrl: styledUpload.url,
      model: intelligence.model,
      prompt: intelligence.prompt,
      rawResponse: JSON.parse(JSON.stringify(intelligence.rawResponse)),
      parsedResponse: intelligence.metadata,
      status: "success"
    }
  });

  const primaryImage = product.images[0];

  revalidatePath("/");
  revalidatePath("/capture");
  revalidatePath("/inventory");
  revalidatePath("/review");

  return {
    ok: true,
    message: "Draft created and queued for review.",
    product: {
      id: product.id,
      title: product.title,
      styledImageUrl: primaryImage?.processedUrl ?? primaryImage?.thumbnailUrl ?? primaryImage?.originalUrl ?? ""
    }
  };
}

export async function approveProductAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  await updateProductStatus(productId, "approved");

  revalidatePath("/review");
  revalidatePath("/inventory");
}

export async function publishProductAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const primaryImage = await getPrimaryImage(product.id);
  await publishToStorefront({
    ...product,
    imageUrl: primaryImage?.processedUrl ?? primaryImage?.thumbnailUrl ?? primaryImage?.originalUrl ?? null
  });

  await updateProductStatus(productId, "published", {
    publishedAt: new Date()
  });

  revalidatePath("/review");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function saveStudioSettingsAction(formData: FormData) {
  const parsed = studioSettingsSchema.parse({
    brandVoice: formData.get("brandVoice"),
    defaultMarkupPercent: formData.get("defaultMarkupPercent"),
    defaultCollection: formData.get("defaultCollection"),
    publishMode: formData.get("publishMode")
  });

  await Promise.all([
    upsertAppSetting("brandVoice", parsed.brandVoice),
    upsertAppSetting("defaultMarkupPercent", parsed.defaultMarkupPercent),
    upsertAppSetting("defaultCollection", parsed.defaultCollection),
    upsertAppSetting("publishMode", parsed.publishMode)
  ]);

  revalidatePath("/settings");
}
