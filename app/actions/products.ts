"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createPendingCaptureDraft,
  failPendingCaptureDraft,
  finalizePendingCaptureDraft,
  updateProductStatus
} from "@/db/products";
import { getPrimaryImage, getProductById, upsertAppSetting } from "@/db/queries";
import { studioSettingsSchema } from "@/db/validators";
import {
  buildMetadataPrompt,
  generateProductIntelligence,
  PRODUCT_METADATA_MODEL,
  PRODUCT_STYLING_MODEL
} from "@/lib/ai";
import { assertFeatureEnabled } from "@/lib/env";
import { publishToStorefront } from "@/lib/storefront";
import { uploadFileToBlob, uploadStyledBufferToBlob } from "@/lib/blob";

const captureSchema = z.object({
  itemNameIdea: z.string().trim().max(120).optional().or(z.literal("")),
  materials: z.string().trim().max(200).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(0).default(1),
  estimatedTimeSpent: z.string().trim().max(120).optional().or(z.literal("")),
  specialDetails: z.string().trim().max(1200).optional().or(z.literal("")),
  image: z.instanceof(File)
});

function compactParts(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

function buildCaptureNotes(input: {
  itemNameIdea?: string;
  materials?: string;
  quantity: number;
  estimatedTimeSpent?: string;
  specialDetails?: string;
}) {
  return compactParts([
    input.itemNameIdea ? `Item name idea: ${input.itemNameIdea}` : null,
    input.materials ? `Materials: ${input.materials}` : null,
    `Quantity: ${input.quantity}`,
    input.estimatedTimeSpent ? `Estimated time spent: ${input.estimatedTimeSpent}` : null,
    input.specialDetails ? `Special details: ${input.specialDetails}` : null
  ]).join("\n");
}

function getCaptureFailureMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The photo was saved, but AI generation failed. Please try again from the capture screen.";
}

export async function ingestProductCapture(_: unknown, formData: FormData) {
  const cameraImage = formData.get("cameraImage");
  const galleryImage = formData.get("galleryImage");
  const image =
    cameraImage instanceof File && cameraImage.size > 0
      ? cameraImage
      : galleryImage instanceof File && galleryImage.size > 0
        ? galleryImage
        : null;

  const parsed = captureSchema.safeParse({
    itemNameIdea: formData.get("itemNameIdea"),
    materials: formData.get("materials"),
    quantity: formData.get("quantity"),
    estimatedTimeSpent: formData.get("estimatedTimeSpent"),
    specialDetails: formData.get("specialDetails"),
    image
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

  const { image, itemNameIdea, materials, quantity, estimatedTimeSpent, specialDetails } = parsed.data;
  const captureNotes = buildCaptureNotes({
    itemNameIdea,
    materials,
    quantity,
    estimatedTimeSpent,
    specialDetails
  });
  const generationPrompt = buildMetadataPrompt({
    imageFile: image,
    titleHint: itemNameIdea,
    notes: captureNotes,
    materials
  });

  const originalUpload = await uploadFileToBlob(image, "originals");
  const pendingDraft = await createPendingCaptureDraft({
    titleHint: itemNameIdea,
    quantity,
    notes: captureNotes,
    originalImageUrl: originalUpload.url,
    aiModel: `${PRODUCT_METADATA_MODEL} + ${PRODUCT_STYLING_MODEL}`,
    aiPrompt: generationPrompt
  });

  try {
    const intelligence = await generateProductIntelligence({
      titleHint: itemNameIdea,
      notes: captureNotes,
      materials,
      imageFile: image
    });

    const slugBase = intelligence.metadata.title || itemNameIdea || "product-capture";
    const styledUpload = intelligence.styledImageBuffer
      ? await uploadStyledBufferToBlob(
          `${slugBase
            .normalize("NFKD")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "") || "product-capture"}.png`,
          intelligence.styledImageBuffer,
          intelligence.styledImageContentType
        )
      : null;

    const product = await finalizePendingCaptureDraft({
      productId: pendingDraft.productId,
      generationId: pendingDraft.generationId,
      title: intelligence.metadata.title || itemNameIdea || "New product capture",
      description: intelligence.metadata.description,
      shortDescription: intelligence.metadata.merchandisingNotes.slice(0, 180),
      category: intelligence.metadata.category,
      subcategory: intelligence.metadata.collection,
      price: 0,
      quantity,
      materials: intelligence.metadata.materials.length
        ? intelligence.metadata.materials
        : compactParts([materials]),
      colors: intelligence.metadata.colorTone ? [intelligence.metadata.colorTone] : [],
      tags: compactParts([
        ...intelligence.metadata.tags,
        intelligence.metadata.finish,
        intelligence.metadata.dimensions
      ]),
      aiConfidence: intelligence.metadata.confidence,
      aiNotes: compactParts([intelligence.metadata.merchandisingNotes, captureNotes]).join("\n\n"),
      originalImageUrl: originalUpload.url,
      processedImageUrl: styledUpload?.url ?? null,
      thumbnailUrl: styledUpload?.url ?? null,
      aiModel: intelligence.model,
      aiPrompt: intelligence.prompt,
      rawResponse: JSON.parse(JSON.stringify(intelligence.rawResponse)),
      parsedResponse: intelligence.metadata
    });

    const primaryImage = product.images[0];

    revalidatePath("/");
    revalidatePath("/capture");
    revalidatePath("/inventory");
    revalidatePath("/review");

    return {
      ok: true,
      message: "Draft created and queued for review.",
      redirectTo: `/review?draft=${product.id}`,
      product: {
        id: product.id,
        title: product.title,
        styledImageUrl: primaryImage?.processedUrl ?? primaryImage?.thumbnailUrl ?? primaryImage?.originalUrl ?? ""
      }
    };
  } catch (error) {
    const message = getCaptureFailureMessage(error);

    await failPendingCaptureDraft({
      productId: pendingDraft.productId,
      generationId: pendingDraft.generationId,
      errorMessage: message
    });

    revalidatePath("/capture");
    revalidatePath("/review");

    return {
      ok: false,
      message,
      product: {
        id: pendingDraft.productId,
        title: itemNameIdea || "New product capture",
        styledImageUrl: originalUpload.url
      }
    };
  }
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
