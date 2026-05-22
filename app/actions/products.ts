"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createAiGenerationLog,
  createProcessedProductImage,
  createPendingCaptureDraft,
  failPendingCaptureDraft,
  finalizePendingCaptureDraft,
  saveStylePreset,
  selectFinalAiGeneration,
  setDefaultStylePreset,
  setPrimaryProductImage,
  updateAiGenerationLog,
  updateProductReviewDraft,
  updateProductStatus
} from "@/db/products";
import { getProductById, getStylePresetById, upsertAppSetting } from "@/db/queries";
import { productStatuses, type ProductStatus } from "@/db/schema";
import { stylePresetInputSchema } from "@/db/validators";
import { buildMetadataPrompt, generateProductIntelligence, PRODUCT_METADATA_MODEL, PRODUCT_STYLING_MODEL } from "@/lib/ai";
import type { GenerationReviewSnapshot } from "@/lib/ai/generation-history";
import { generationOptionsSchema, type GenerationOptions } from "@/lib/ai/generation-options";
import {
  PRODUCT_IMAGE_MODEL,
  generateProductImageVariant,
  generateProductMetadata,
  getErrorMessage
} from "@/lib/ai/openai";
import { assertFeatureEnabled, getFeatureStatus } from "@/lib/env";
import { getDefaultStylePresetForGeneration } from "@/lib/data/products";
import { publishProduct } from "@/lib/publishing/publisher";
import {
  STUDIO_SETTINGS_CACHE_TAG,
  STUDIO_SETTINGS_SETTING_KEY,
  STORE_API_KEY_SETTING_KEY,
  studioSettingsSchema
} from "@/lib/studio-settings";
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

function getSafeRedirect(formData: FormData, fallback: string) {
  const redirectTo = formData.get("redirectTo");
  return typeof redirectTo === "string" && redirectTo.startsWith("/") ? redirectTo : fallback;
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    throw new Error(`Missing field: ${key}`);
  }

  return value;
}

function parseLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseExampleDescriptionBlocks(value: string) {
  return value
    .split(/\n\s*---\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCategoryValueLines(value: string) {
  return parseLineList(value).map((line) => {
    const [category, amount, ...extra] = line.split("|").map((part) => part.trim());

    if (!category || !amount || extra.length > 0) {
      throw new Error(`Invalid category base price line: "${line}"`);
    }

    return {
      category,
      value: Number(amount)
    };
  });
}

function parseComplexityMultiplierLines(value: string) {
  return parseLineList(value).map((line) => {
    const [label, multiplier, ...extra] = line.split("|").map((part) => part.trim());

    if (!label || !multiplier || extra.length > 0) {
      throw new Error(`Invalid complexity multiplier line: "${line}"`);
    }

    return {
      label,
      multiplier: Number(multiplier)
    };
  });
}

function parseSubcategoryLines(value: string) {
  return parseLineList(value).map((line) => {
    const [category, subcategory, ...extra] = line.split("|").map((part) => part.trim());

    if (!category || !subcategory || extra.length > 0) {
      throw new Error(`Invalid subcategory line: "${line}"`);
    }

    return { category, subcategory };
  });
}

function parseUserLines(value: string) {
  return parseLineList(value).map((line) => {
    const [name, role, ...extra] = line.split("|").map((part) => part.trim());

    if (!name || !role || extra.length > 0) {
      throw new Error(`Invalid user line: "${line}"`);
    }

    return { name, role };
  });
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

function readInventoryStatus(formData: FormData) {
  const status = formData.get("status");

  if (typeof status !== "string") {
    return null;
  }

  return productStatuses.includes(status as ProductStatus) ? (status as ProductStatus) : null;
}

function readSelectedProductIds(formData: FormData) {
  return z.array(z.string().uuid()).parse(formData.getAll("productIds"));
}

function readStylePresetId(formData: FormData) {
  const value = formData.get("stylePresetId");
  return typeof value === "string" && value.length ? z.string().uuid().parse(value) : null;
}

function readGenerationOptions(formData: FormData, scope: GenerationOptions["scope"]) {
  return generationOptionsSchema.parse({
    scope,
    creativity: formData.get("creativity"),
    descriptionTone: formData.get("descriptionTone"),
    priceStrategy: formData.get("priceStrategy"),
    humanInstruction: readOptionalString(formData, "humanInstruction"),
    stylePresetId: readStylePresetId(formData)
  });
}

async function saveReviewEdits(formData: FormData, status?: "draft" | "approved") {
  const input = readReviewFormData(formData);
  return updateProductReviewDraft(input, status ? { status } : undefined);
}

async function regenerateProductMetadataForScope(productId: string, options: GenerationOptions) {
  assertFeatureEnabled("database");
  assertFeatureEnabled("openai");

  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const originalImageUrl = getOriginalImageUrl(product);
  const generation = await createAiGenerationLog({
    productId,
    inputImageUrl: originalImageUrl,
    model: PRODUCT_METADATA_MODEL,
    prompt: `Regenerating product metadata (${options.scope})`,
    options,
    humanInstruction: options.humanInstruction,
    status: "pending"
  });

  try {
    const metadataResult = await generateProductMetadata({
      imageUrl: originalImageUrl,
      filenameHint: `${product.slug || product.id}.png`,
      ...getProductMetadataPromptContext(product, options)
    });

    await applyMetadataResultToProduct({
      product,
      metadata: metadataResult.metadata,
      scope: options.scope
    });

    await updateAiGenerationLog({
      generationId: generation.id,
      model: metadataResult.model,
      prompt: metadataResult.prompt,
      options,
      humanInstruction: options.humanInstruction,
      rawResponse: metadataResult.rawResponse,
      parsedResponse: buildGenerationReviewSnapshot({
        metadata: metadataResult.metadata
      }),
      status: "success",
      errorMessage: null
    });

    await selectFinalAiGeneration({
      productId,
      generationId: generation.id
    });
  } catch (error) {
    await updateAiGenerationLog({
      generationId: generation.id,
      options,
      humanInstruction: options.humanInstruction,
      status: "failed",
      errorMessage: getErrorMessage(error)
    });
    throw error;
  }
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

function getProductImagePromptContextWithOptions(
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>,
  options: Pick<GenerationOptions, "creativity" | "humanInstruction">
) {
  return {
    ...getProductImagePromptContext(product),
    creativity: options.creativity,
    humanInstruction: options.humanInstruction
  };
}

function getProductMetadataPromptContext(
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>,
  options?: Pick<GenerationOptions, "creativity" | "descriptionTone" | "priceStrategy" | "humanInstruction" | "scope">
) {
  return {
    itemNameIdea: product.title,
    notes: product.aiNotes ?? undefined,
    materials: product.materials.join(", "),
    quantity: product.quantity,
    creativity: options?.creativity,
    descriptionTone: options?.descriptionTone,
    priceStrategy: options?.priceStrategy,
    humanInstruction: options?.humanInstruction,
    scope: options?.scope
  };
}

function buildGenerationReviewSnapshot(input: {
  metadata?: {
    title: string;
    description: string;
    shortDescription: string | null;
    category: string;
    subcategory: string | null;
    price: number;
    compareAtPrice: number | null;
    quantity: number;
    materials: string[];
    colors: string[];
    tags: string[];
    notesForHuman: string;
    confidence: number;
  } | null;
  image?: {
    originalImageUrl: string;
    processedImageUrl: string | null;
    cleanBackgroundImageUrl?: string | null;
    variant: "primary" | "clean-background";
  } | null;
}): GenerationReviewSnapshot {
  return {
    metadata: input.metadata
      ? {
          title: input.metadata.title,
          description: input.metadata.description,
          shortDescription: input.metadata.shortDescription,
          category: input.metadata.category,
          subcategory: input.metadata.subcategory,
          price: input.metadata.price,
          compareAtPrice: input.metadata.compareAtPrice,
          quantity: input.metadata.quantity,
          materials: input.metadata.materials,
          colors: input.metadata.colors,
          tags: input.metadata.tags,
          aiNotes: input.metadata.notesForHuman,
          aiConfidence: input.metadata.confidence
        }
      : null,
    images: input.image
      ? {
          originalImageUrl: input.image.originalImageUrl,
          processedImageUrl: input.image.processedImageUrl,
          cleanBackgroundImageUrl: input.image.cleanBackgroundImageUrl ?? null,
          variant: input.image.variant
        }
      : null
  };
}

async function applyMetadataResultToProduct(input: {
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>;
  metadata: Awaited<ReturnType<typeof generateProductMetadata>>["metadata"];
  scope: GenerationOptions["scope"];
}) {
  const { product, metadata, scope } = input;
  const useAllMetadata = scope === "all";

  await updateProductReviewDraft(
    {
      productId: product.id,
      title: scope === "price" || scope === "category_tags" ? product.title : metadata.title,
      description: scope === "price" || scope === "category_tags" ? product.description : metadata.description,
      shortDescription:
        scope === "price" || scope === "category_tags"
          ? product.shortDescription
          : metadata.shortDescription,
      category:
        scope === "title_description" || scope === "price"
          ? product.category
          : metadata.category,
      subcategory:
        scope === "title_description" || scope === "price"
          ? product.subcategory
          : metadata.subcategory,
      price:
        scope === "title_description" || scope === "category_tags"
          ? Number(product.price)
          : metadata.price,
      compareAtPrice:
        scope === "title_description" || scope === "category_tags"
          ? product.compareAtPrice === null
            ? null
            : Number(product.compareAtPrice)
          : metadata.compareAtPrice,
      quantity: useAllMetadata ? metadata.quantity : product.quantity,
      materials: useAllMetadata ? metadata.materials : product.materials,
      colors: useAllMetadata ? metadata.colors : product.colors,
      tags: useAllMetadata || scope === "category_tags" ? metadata.tags : product.tags,
      aiNotes: metadata.notesForHuman,
      aiConfidence: metadata.confidence
    },
    { status: "review" }
  );
}

function revalidateProductSurfaces(productId?: string) {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/review");

  if (productId) {
    revalidatePath(`/inventory/${productId}`);
    revalidatePath(`/review/${productId}`);
  }
}

export async function ingestProductCapture(_: unknown, formData: FormData) {
  const cameraImage = formData.get("cameraImage");
  const galleryImage = formData.get("galleryImage");
  const selectedImage =
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
    image: selectedImage
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

  const defaultStylePreset = await getDefaultStylePresetForGeneration();

  if (!defaultStylePreset) {
    throw new Error("A default style preset is required before capturing products.");
  }

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
    materials,
    stylePreset: defaultStylePreset
  });

  const originalUpload = await uploadFileToBlob(image, "originals");
  const pendingDraft = await createPendingCaptureDraft({
    titleHint: itemNameIdea,
    quantity,
    notes: captureNotes,
    originalImageUrl: originalUpload.url,
    aiModel: `${PRODUCT_METADATA_MODEL} + ${PRODUCT_STYLING_MODEL}`,
    aiPrompt: generationPrompt,
    stylePresetId: defaultStylePreset.id
  });

  try {
    const intelligence = await generateProductIntelligence({
      titleHint: itemNameIdea,
      notes: captureNotes,
      materials,
      imageFile: image,
      stylePreset: defaultStylePreset
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
      stylePresetId: defaultStylePreset.id,
      rawResponse: JSON.parse(JSON.stringify(intelligence.rawResponse)),
      parsedResponse: {
        metadata: {
          title: intelligence.metadata.title || itemNameIdea || "New product capture",
          description: intelligence.metadata.description,
          shortDescription: intelligence.metadata.merchandisingNotes.slice(0, 180),
          category: intelligence.metadata.category,
          subcategory: intelligence.metadata.collection,
          price: 0,
          compareAtPrice: null,
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
          aiNotes: compactParts([intelligence.metadata.merchandisingNotes, captureNotes]).join("\n\n"),
          aiConfidence: intelligence.metadata.confidence
        },
        images: {
          originalImageUrl: originalUpload.url,
          processedImageUrl: styledUpload?.url ?? null,
          cleanBackgroundImageUrl: null,
          variant: styledUpload?.url ? "primary" : null
        }
      }
    });

    await selectFinalAiGeneration({
      productId: product.id,
      generationId: pendingDraft.generationId
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
  await publishProduct(productId);

  revalidateProductSurfaces(productId);
  redirect(getSafeRedirect(formData, `/inventory/${productId}`));
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
  await publishProduct(productId);

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
  const productId = z.string().uuid().parse(formData.get("productId"));
  await regenerateProductMetadataForScope(productId, readGenerationOptions(formData, "title_description"));

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function regenerateProductPriceAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  await regenerateProductMetadataForScope(productId, readGenerationOptions(formData, "price"));

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function regenerateProductCategoryTagsAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  await regenerateProductMetadataForScope(productId, readGenerationOptions(formData, "category_tags"));

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

async function regenerateProductImageWithOptions(input: {
  productId: string;
  options: GenerationOptions;
  useSelectedStylePreset: boolean;
}) {
  assertFeatureEnabled("database");
  assertFeatureEnabled("openai");
  assertFeatureEnabled("blob");

  const product = await getProductById(input.productId);
  const fallbackStylePreset = await getDefaultStylePresetForGeneration();
  const stylePreset = input.useSelectedStylePreset
    ? input.options.stylePresetId
      ? await getStylePresetById(input.options.stylePresetId)
      : fallbackStylePreset
    : product?.aiGenerations.find((generation) => generation.isSelectedFinal)?.stylePreset ?? fallbackStylePreset;

  if (!product) {
    throw new Error("Product not found.");
  }

  if (!stylePreset) {
    throw new Error("Style preset not found.");
  }

  const originalImageUrl = getOriginalImageUrl(product);
  const generation = await createAiGenerationLog({
    productId: input.productId,
    stylePresetId: stylePreset.id,
    inputImageUrl: originalImageUrl,
    model: PRODUCT_IMAGE_MODEL,
    prompt: "Regenerating processed image",
    options: input.options,
    humanInstruction: input.options.humanInstruction,
    status: "pending"
  });

  try {
    const imageResult = await generateProductImageVariant(
      {
        imageUrl: originalImageUrl,
        filenameHint: `${product.slug || product.id}.png`,
        ...getProductImagePromptContextWithOptions(product, input.options),
        stylePreset
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
      productId: input.productId,
      originalImageUrl,
      processedImageUrl: uploadedImage.url,
      thumbnailUrl: uploadedImage.url,
      altText: product.title,
      makePrimary: true
    });

    await updateAiGenerationLog({
      generationId: generation.id,
      stylePresetId: stylePreset.id,
      outputImageUrl: uploadedImage.url,
      model: imageResult.model,
      prompt: imageResult.prompt,
      options: input.options,
      humanInstruction: input.options.humanInstruction,
      rawResponse: imageResult.rawResponse,
      parsedResponse: buildGenerationReviewSnapshot({
        image: {
          originalImageUrl,
          processedImageUrl: uploadedImage.url,
          variant: imageResult.variant
        }
      }),
      status: "success",
      errorMessage: null
    });

    await updateProductStatus(input.productId, "review", {
      publishedAt: null
    });
    await selectFinalAiGeneration({
      productId: input.productId,
      generationId: generation.id
    });
  } catch (error) {
    await updateAiGenerationLog({
      generationId: generation.id,
      options: input.options,
      humanInstruction: input.options.humanInstruction,
      status: "failed",
      errorMessage: getErrorMessage(error)
    });
    throw error;
  }
}

export async function regenerateProductImageAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  await regenerateProductImageWithOptions({
    productId,
    options: readGenerationOptions(formData, "image"),
    useSelectedStylePreset: false
  });

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function tryDifferentStylePresetAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  await regenerateProductImageWithOptions({
    productId,
    options: readGenerationOptions(formData, "image"),
    useSelectedStylePreset: true
  });

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function regenerateProductDraftAction(formData: FormData) {
  assertFeatureEnabled("database");
  assertFeatureEnabled("openai");
  assertFeatureEnabled("blob");

  const productId = z.string().uuid().parse(formData.get("productId"));
  const product = await getProductById(productId);
  const stylePreset = await getDefaultStylePresetForGeneration();

  if (!product) {
    throw new Error("Product not found.");
  }

  if (!stylePreset) {
    throw new Error("Style preset not found.");
  }

  const originalImageUrl = getOriginalImageUrl(product);
  const generation = await createAiGenerationLog({
    productId,
    stylePresetId: stylePreset.id,
    inputImageUrl: originalImageUrl,
    model: `${PRODUCT_METADATA_MODEL} | ${PRODUCT_IMAGE_MODEL}`,
    prompt: "Regenerating product draft",
    options: generationOptionsSchema.parse({
      scope: "all",
      creativity: "medium",
      descriptionTone: "clean luxury",
      priceStrategy: "standard",
      humanInstruction: null,
      stylePresetId: stylePreset.id
    }),
    status: "pending"
  });

  try {
    const [metadataResult, imageResult] = await Promise.all([
      generateProductMetadata({
        imageUrl: originalImageUrl,
        filenameHint: `${product.slug || product.id}.png`,
        ...getProductMetadataPromptContext(product, {
          scope: "all",
          creativity: "medium",
          descriptionTone: "clean luxury",
          priceStrategy: "standard",
          humanInstruction: null
        })
      }),
      generateProductImageVariant(
        {
          imageUrl: originalImageUrl,
          filenameHint: `${product.slug || product.id}.png`,
          ...getProductImagePromptContextWithOptions(product, {
            creativity: "medium",
            humanInstruction: null
          }),
          stylePreset
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

    await updateProductReviewDraft(
      {
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
      },
      { status: "review" }
    );

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
      stylePresetId: stylePreset.id,
      outputImageUrl: uploadedImage.url,
      model: `${metadataResult.model} | ${imageResult.model}`,
      prompt: `${metadataResult.prompt}\n\n---\n\n${imageResult.prompt}`,
      options: generationOptionsSchema.parse({
        scope: "all",
        creativity: "medium",
        descriptionTone: "clean luxury",
        priceStrategy: "standard",
        humanInstruction: null,
        stylePresetId: stylePreset.id
      }),
      humanInstruction: null,
      rawResponse: {
        metadata: metadataResult.rawResponse,
        image: imageResult.rawResponse
      },
      parsedResponse: buildGenerationReviewSnapshot({
        metadata: metadataResult.metadata,
        image: {
          originalImageUrl,
          processedImageUrl: uploadedImage.url,
          variant: imageResult.variant
        }
      }),
      status: "success",
      errorMessage: null
    });

    await selectFinalAiGeneration({
      productId,
      generationId: generation.id
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

export async function restoreAiGenerationAction(formData: FormData) {
  assertFeatureEnabled("database");

  const productId = z.string().uuid().parse(formData.get("productId"));
  const generationId = z.string().uuid().parse(formData.get("generationId"));
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const generation = product.aiGenerations.find((item) => item.id === generationId);

  if (!generation) {
    throw new Error("Generation not found.");
  }

  const snapshot = generation.parsedResponse as GenerationReviewSnapshot | null;

  if (snapshot?.metadata) {
    await updateProductReviewDraft(
      {
        productId,
        title: snapshot.metadata.title,
        description: snapshot.metadata.description,
        shortDescription: snapshot.metadata.shortDescription,
        category: snapshot.metadata.category,
        subcategory: snapshot.metadata.subcategory,
        price: snapshot.metadata.price,
        compareAtPrice: snapshot.metadata.compareAtPrice,
        quantity: snapshot.metadata.quantity,
        materials: snapshot.metadata.materials,
        colors: snapshot.metadata.colors,
        tags: snapshot.metadata.tags,
        aiNotes: snapshot.metadata.aiNotes,
        aiConfidence: snapshot.metadata.aiConfidence
      },
      { status: "review" }
    );
  } else {
    await updateProductStatus(productId, "review", {
      publishedAt: null
    });
  }

  if (snapshot?.images?.processedImageUrl && snapshot.images.originalImageUrl) {
    await createProcessedProductImage({
      productId,
      originalImageUrl: snapshot.images.originalImageUrl,
      processedImageUrl: snapshot.images.processedImageUrl,
      thumbnailUrl: snapshot.images.processedImageUrl,
      altText: snapshot.metadata?.title ?? product.title,
      makePrimary: true
    });
  }

  await selectFinalAiGeneration({
    productId,
    generationId
  });

  revalidateProductSurfaces(productId);
  redirect(getReviewRedirect(formData, productId));
}

export async function saveStudioSettingsAction(formData: FormData) {
  assertFeatureEnabled("database");

  const parsed = studioSettingsSchema.parse({
    brandVoice: {
      productDescriptionPrompt: readRequiredString(formData, "productDescriptionPrompt"),
      defaultTone: readRequiredString(formData, "defaultTone"),
      wordsToPrefer: parseLineList(readRequiredString(formData, "wordsToPrefer")),
      wordsToAvoid: parseLineList(readRequiredString(formData, "wordsToAvoid")),
      exampleProductDescriptions: parseExampleDescriptionBlocks(
        readRequiredString(formData, "exampleProductDescriptions")
      )
    },
    pricingRules: {
      categoryBasePrices: parseCategoryValueLines(readRequiredString(formData, "categoryBasePrices")),
      complexityMultipliers: parseComplexityMultiplierLines(readRequiredString(formData, "complexityMultipliers")),
      oneOfOneMarkupPercent: Number(readRequiredString(formData, "oneOfOneMarkupPercent")),
      minimumPrice: Number(readRequiredString(formData, "minimumPrice")),
      defaultCompareAtMarkupPercent: Number(readRequiredString(formData, "defaultCompareAtMarkupPercent"))
    },
    imageStyle: {
      defaultStylePresetId: readRequiredString(formData, "defaultStylePresetId"),
      outputSize: readRequiredString(formData, "outputSize"),
      backgroundPreference: readRequiredString(formData, "backgroundPreference"),
      cropPreference: readRequiredString(formData, "cropPreference")
    },
    publishing: {
      publishMode: readRequiredString(formData, "publishMode"),
      storeApiUrl: readOptionalString(formData, "storeApiUrl"),
      exportFormat: readRequiredString(formData, "exportFormat"),
      exportFilenamePrefix: readRequiredString(formData, "exportFilenamePrefix"),
      exportIncludeImages: formData.get("exportIncludeImages") === "on"
    },
    categories: {
      categories: parseLineList(readRequiredString(formData, "categories")),
      subcategories: parseSubcategoryLines(readRequiredString(formData, "subcategories"))
    },
    users: parseUserLines(readRequiredString(formData, "users"))
  });

  const storeApiKey = readOptionalString(formData, "storeApiKey");

  await Promise.all([
    upsertAppSetting(STUDIO_SETTINGS_SETTING_KEY, parsed),
    setDefaultStylePreset(parsed.imageStyle.defaultStylePresetId),
    storeApiKey ? upsertAppSetting(STORE_API_KEY_SETTING_KEY, storeApiKey) : Promise.resolve()
  ]);

  revalidateTag(STUDIO_SETTINGS_CACHE_TAG, "max");
  revalidatePath("/settings");
  revalidatePath("/app/settings");
}

export async function saveStylePresetAction(formData: FormData) {
  if (!getFeatureStatus().database) {
    redirect("/app/settings/style-presets");
  }

  const parsed = stylePresetInputSchema.parse({
    presetId: readOptionalString(formData, "presetId"),
    name: formData.get("name"),
    description: formData.get("description"),
    backgroundPrompt: formData.get("backgroundPrompt"),
    lightingPrompt: formData.get("lightingPrompt"),
    shadowPrompt: formData.get("shadowPrompt"),
    cropRatio: formData.get("cropRatio"),
    outputSize: formData.get("outputSize"),
    exampleImageUrls: formData.get("exampleImageUrls"),
    isDefault: formData.get("isDefault") === "on"
  });

  await saveStylePreset(parsed);
  revalidateTag(STUDIO_SETTINGS_CACHE_TAG, "max");
  revalidatePath("/settings");
  revalidatePath("/app/settings");
  revalidatePath("/settings/style-presets");
  revalidatePath("/app/settings/style-presets");
  redirect("/app/settings/style-presets");
}

export async function setDefaultStylePresetAction(formData: FormData) {
  if (!getFeatureStatus().database) {
    redirect("/app/settings/style-presets");
  }

  const stylePresetId = z.string().uuid().parse(formData.get("stylePresetId"));
  await setDefaultStylePreset(stylePresetId);
  revalidateTag(STUDIO_SETTINGS_CACHE_TAG, "max");
  revalidatePath("/settings");
  revalidatePath("/app/settings");
  revalidatePath("/settings/style-presets");
  revalidatePath("/app/settings/style-presets");
  redirect("/app/settings/style-presets");
}

export async function saveInventoryProductAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  const redirectTo = getSafeRedirect(formData, `/inventory/${productId}`);
  const status = readInventoryStatus(formData);

  if (!getFeatureStatus().database) {
    redirect(redirectTo);
  }

  await updateProductReviewDraft(readReviewFormData(formData));

  if (status && status !== "published") {
    await updateProductStatus(productId, status, {
      publishedAt: null
    });
  }

  revalidateProductSurfaces(productId);
  revalidatePath(`/inventory/${productId}`);
  redirect(redirectTo);
}

export async function approveSelectedProductsAction(formData: FormData) {
  if (getFeatureStatus().database) {
    const productIds = readSelectedProductIds(formData);

    if (productIds.length) {
      await Promise.all(productIds.map((productId) => updateProductStatus(productId, "approved")));
    }
  }

  revalidateProductSurfaces();
  redirect("/inventory");
}

export async function archiveSelectedProductsAction(formData: FormData) {
  if (getFeatureStatus().database) {
    const productIds = readSelectedProductIds(formData);

    if (productIds.length) {
      await Promise.all(productIds.map((productId) => updateProductStatus(productId, "archived")));
    }
  }

  revalidateProductSurfaces();
  redirect("/inventory");
}

export async function markSelectedSoldAction(formData: FormData) {
  if (getFeatureStatus().database) {
    const productIds = readSelectedProductIds(formData);

    if (productIds.length) {
      await Promise.all(productIds.map((productId) => updateProductStatus(productId, "sold")));
    }
  }

  revalidateProductSurfaces();
  redirect("/inventory");
}

export async function generateSelectedMetadataAction(formData: FormData) {
  const features = getFeatureStatus();

  if (features.database && features.openai) {
    const productIds = readSelectedProductIds(formData);

    for (const productId of productIds) {
      await regenerateProductMetadataForScope(
        productId,
        generationOptionsSchema.parse({
          scope: "all",
          creativity: "medium",
          descriptionTone: "clean luxury",
          priceStrategy: "standard",
          humanInstruction: null,
          stylePresetId: null
        })
      );
    }
  }

  revalidateProductSurfaces();
  redirect("/inventory");
}
