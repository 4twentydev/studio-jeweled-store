"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createAiGenerationLog,
  createProcessedProductImage,
  createPendingCaptureDraft,
  failPendingCaptureDraft,
  finalizePendingCaptureDraft,
  setPrimaryProductImage,
  updateAiGenerationLog,
  updateProductReviewDraft,
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
import {
  PRODUCT_IMAGE_MODEL,
  generateProductImageVariant,
  generateProductMetadata,
  getErrorMessage
} from "@/lib/ai/openai";
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

function getReviewRedirect(formData: FormData, productId: string) {
  const redirectTo = formData.get("redirectTo");
  return typeof redirectTo === "string" && redirectTo.startsWith("/") ? redirectTo : `/review/${productId}`;
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readReviewFormData(formData: FormData) {
  return {
    productId: z.string().uuid().parse(formData.get("productId")),
    title: z.string().parse(formData.get("title")),
    description: z.string().parse(formData.get("description")),
    shortDescription: readOptionalString(formData, "shortDescription"),
    category: z.string().parse(formData.get("category")),
    subcategory: readOptionalString(formData, "subcategory"),
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice"),
    quantity: formData.get("quantity"),
    materials: typeof formData.get("materials") === "string" ? formData.get("materials") : "",
    colors: typeof formData.get("colors") === "string" ? formData.get("colors") : "",
    tags: typeof formData.get("tags") === "string" ? formData.get("tags") : "",
    aiNotes: readOptionalString(formData, "aiNotes"),
    aiConfidence: formData.get("aiConfidence")
  };
}

async function saveReviewEdits(formData: FormData, status?: "draft" | "approved") {
  const input = readReviewFormData(formData);
  return updateProductReviewDraft(input, status ? { status } : undefined);
}

function getOriginalImageUrl(product: NonNullable<Awaited<ReturnType<typeof getProductById>>>) {
  const originalImage =
    product.images.find((image) => image.imageKind === "original") ??
    product.images.find((image) => Boolean(image.originalUrl));

  if (!originalImage?.originalUrl) {
    throw new Error("Original image not found for this product.");
  }

  return originalImage.originalUrl;
}

function getProductImagePromptContext(product: NonNullable<Awaited<ReturnType<typeof getProductById>>>) {
  return {
    itemNameIdea: product.title,
    materials: product.materials.join(", "),
    notes: product.aiNotes ?? undefined,
    specialDetails: product.tags.join(", ")
  };
}

function getProductMetadataPromptContext(product: NonNullable<Awaited<ReturnType<typeof getProductById>>>) {
  return {
    itemNameIdea: product.title,
    notes: product.aiNotes ?? undefined,
    materials: product.materials.join(", "),
    quantity: product.quantity
  };
}

function revalidateProductSurfaces(productId?: string) {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/review");

  if (productId) {
    revalidatePath(`/review/${productId}`);
  }
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
      redirectTo: `/review/${product.id}`,
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

  revalidateProductSurfaces(productId);
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

  revalidateProductSurfaces(productId);
}

export async function saveReviewDraftAction(formData: FormData) {
  const product = await saveReviewEdits(formData, "draft");
  const productId = product?.id ?? z.string().uuid().parse(formData.get("productId"));

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function approveReviewedProductAction(formData: FormData) {
  const product = await saveReviewEdits(formData, "approved");
  const productId = product?.id ?? z.string().uuid().parse(formData.get("productId"));

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function publishReviewedProductAction(formData: FormData) {
  const savedProduct = await saveReviewEdits(formData);
  const productId = savedProduct?.id ?? z.string().uuid().parse(formData.get("productId"));
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

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function archiveProductAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  await updateProductStatus(productId, "archived");

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function setPrimaryImageAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  const imageId = z.string().uuid().parse(formData.get("imageId"));

  await setPrimaryProductImage({
    productId,
    imageId
  });

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function replaceProcessedImageAction(formData: FormData) {
  assertFeatureEnabled("database");
  assertFeatureEnabled("blob");

  const productId = z.string().uuid().parse(formData.get("productId"));
  const file = formData.get("processedImage");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A replacement image file is required.");
  }

  const product = await getProductById(productId);
  if (!product) {
    throw new Error("Product not found.");
  }

  const originalImageUrl = getOriginalImageUrl(product);
  const uploadedImage = await uploadFileToBlob(file, "processed-manual");

  await createProcessedProductImage({
    productId,
    originalImageUrl,
    processedImageUrl: uploadedImage.url,
    thumbnailUrl: uploadedImage.url,
    altText: product.title,
    makePrimary: true
  });

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function regenerateProductTextAction(formData: FormData) {
  assertFeatureEnabled("database");
  assertFeatureEnabled("openai");

  const productId = z.string().uuid().parse(formData.get("productId"));
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const originalImageUrl = getOriginalImageUrl(product);
  const generation = await createAiGenerationLog({
    productId,
    inputImageUrl: originalImageUrl,
    model: PRODUCT_METADATA_MODEL,
    prompt: "Regenerating product metadata",
    status: "pending"
  });

  try {
    const metadataResult = await generateProductMetadata({
      imageUrl: originalImageUrl,
      filenameHint: `${product.slug || product.id}.png`,
      ...getProductMetadataPromptContext(product)
    });

    await updateProductReviewDraft({
      productId,
      title: metadataResult.metadata.title,
      description: metadataResult.metadata.description,
      shortDescription: metadataResult.metadata.shortDescription,
      category: metadataResult.metadata.category,
      subcategory: metadataResult.metadata.subcategory,
      price: metadataResult.metadata.price,
      compareAtPrice: metadataResult.metadata.compareAtPrice,
      quantity: metadataResult.metadata.quantity,
      materials: metadataResult.metadata.materials,
      colors: metadataResult.metadata.colors,
      tags: metadataResult.metadata.tags,
      aiNotes: metadataResult.metadata.notesForHuman,
      aiConfidence: metadataResult.metadata.confidence
    });

    await updateAiGenerationLog({
      generationId: generation.id,
      model: metadataResult.model,
      prompt: metadataResult.prompt,
      rawResponse: metadataResult.rawResponse,
      parsedResponse: metadataResult.metadata,
      status: "success",
      errorMessage: null
    });
  } catch (error) {
    await updateAiGenerationLog({
      generationId: generation.id,
      status: "failed",
      errorMessage: getErrorMessage(error)
    });
    throw error;
  }

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function regenerateProductImageAction(formData: FormData) {
  assertFeatureEnabled("database");
  assertFeatureEnabled("openai");
  assertFeatureEnabled("blob");

  const productId = z.string().uuid().parse(formData.get("productId"));
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const originalImageUrl = getOriginalImageUrl(product);
  const generation = await createAiGenerationLog({
    productId,
    inputImageUrl: originalImageUrl,
    model: PRODUCT_IMAGE_MODEL,
    prompt: "Regenerating processed image",
    status: "pending"
  });

  try {
    const imageResult = await generateProductImageVariant(
      {
        imageUrl: originalImageUrl,
        filenameHint: `${product.slug || product.id}.png`,
        ...getProductImagePromptContext(product)
      },
      "primary"
    );

    const uploadedImage = await uploadStyledBufferToBlob(
      `${product.slug || product.id}.png`,
      imageResult.buffer,
      imageResult.contentType,
      "processed"
    );

    await createProcessedProductImage({
      productId,
      originalImageUrl,
      processedImageUrl: uploadedImage.url,
      thumbnailUrl: uploadedImage.url,
      altText: product.title,
      makePrimary: true
    });

    await updateAiGenerationLog({
      generationId: generation.id,
      outputImageUrl: uploadedImage.url,
      model: imageResult.model,
      prompt: imageResult.prompt,
      rawResponse: imageResult.rawResponse,
      parsedResponse: {
        productId,
        variant: imageResult.variant
      },
      status: "success",
      errorMessage: null
    });
  } catch (error) {
    await updateAiGenerationLog({
      generationId: generation.id,
      status: "failed",
      errorMessage: getErrorMessage(error)
    });
    throw error;
  }

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function regenerateProductDraftAction(formData: FormData) {
  assertFeatureEnabled("database");
  assertFeatureEnabled("openai");
  assertFeatureEnabled("blob");

  const productId = z.string().uuid().parse(formData.get("productId"));
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const originalImageUrl = getOriginalImageUrl(product);
  const generation = await createAiGenerationLog({
    productId,
    inputImageUrl: originalImageUrl,
    model: `${PRODUCT_METADATA_MODEL} | ${PRODUCT_IMAGE_MODEL}`,
    prompt: "Regenerating product draft",
    status: "pending"
  });

  try {
    const [metadataResult, imageResult] = await Promise.all([
      generateProductMetadata({
        imageUrl: originalImageUrl,
        filenameHint: `${product.slug || product.id}.png`,
        ...getProductMetadataPromptContext(product)
      }),
      generateProductImageVariant(
        {
          imageUrl: originalImageUrl,
          filenameHint: `${product.slug || product.id}.png`,
          ...getProductImagePromptContext(product)
        },
        "primary"
      )
    ]);

    const uploadedImage = await uploadStyledBufferToBlob(
      `${product.slug || product.id}.png`,
      imageResult.buffer,
      imageResult.contentType,
      "processed"
    );

    await updateProductReviewDraft({
      productId,
      title: metadataResult.metadata.title,
      description: metadataResult.metadata.description,
      shortDescription: metadataResult.metadata.shortDescription,
      category: metadataResult.metadata.category,
      subcategory: metadataResult.metadata.subcategory,
      price: metadataResult.metadata.price,
      compareAtPrice: metadataResult.metadata.compareAtPrice,
      quantity: metadataResult.metadata.quantity,
      materials: metadataResult.metadata.materials,
      colors: metadataResult.metadata.colors,
      tags: metadataResult.metadata.tags,
      aiNotes: metadataResult.metadata.notesForHuman,
      aiConfidence: metadataResult.metadata.confidence
    });

    await createProcessedProductImage({
      productId,
      originalImageUrl,
      processedImageUrl: uploadedImage.url,
      thumbnailUrl: uploadedImage.url,
      altText: metadataResult.metadata.altText,
      makePrimary: true
    });

    await updateAiGenerationLog({
      generationId: generation.id,
      outputImageUrl: uploadedImage.url,
      model: `${metadataResult.model} | ${imageResult.model}`,
      prompt: `${metadataResult.prompt}\n\n---\n\n${imageResult.prompt}`,
      rawResponse: {
        metadata: metadataResult.rawResponse,
        image: imageResult.rawResponse
      },
      parsedResponse: metadataResult.metadata,
      status: "success",
      errorMessage: null
    });
  } catch (error) {
    await updateAiGenerationLog({
      generationId: generation.id,
      status: "failed",
      errorMessage: getErrorMessage(error)
    });
    throw error;
  }

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
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
