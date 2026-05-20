import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getProductById, listSkusForDate } from "@/db/queries";
import {
  aiGenerations,
  productImages,
  products,
  publishResults,
  stylePresets,
  type ProductStatus,
  type PublishMode
} from "@/db/schema";
import {
  productDraftSchema,
  productReviewUpdateSchema,
  stylePresetInputSchema,
  productStatusUpdateSchema,
  toNumericValue
} from "@/db/validators";
import { buildSku, formatSkuDate } from "@/lib/labels";

export const INITIAL_CATEGORIES = [
  "Lighters",
  "Lighter Cases",
  "Containers",
  "Lip Balm Holders",
  "Accessories",
  "Custom Pieces",
  "One-of-One"
] as const;

function randomSuffix(length = 6) {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length).toUpperCase();
}

export function generateSlug(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSkuSequenceForDate(sku: string, dateStamp: string) {
  const match = sku.match(new RegExp(`^JWLD-[A-Z0-9]+-${dateStamp}-(\\d{4})$`));
  return match ? Number.parseInt(match[1], 10) : null;
}

async function generateSku(category: string, date: Date) {
  const dateStamp = formatSkuDate(date);
  const skus = await listSkusForDate(dateStamp);
  const nextSequence =
    skus.reduce((max, record) => {
      const sequence = parseSkuSequenceForDate(record.sku, dateStamp);
      return sequence === null ? max : Math.max(max, sequence);
    }, 0) + 1;

  return buildSku(category, date, nextSequence);
}

function isSkuConflict(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("products_sku_unique") || error.message.includes("duplicate key");
}

export function formatPrice(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

export function normalizeCategory(input: string) {
  const normalized = input.trim().toLowerCase();

  const match = INITIAL_CATEGORIES.find((category) => category.toLowerCase() === normalized);
  if (match) {
    return match;
  }

  if (normalized.includes("lighter") && normalized.includes("case")) {
    return "Lighter Cases";
  }

  if (normalized.includes("lighter")) {
    return "Lighters";
  }

  if (normalized.includes("container")) {
    return "Containers";
  }

  if (normalized.includes("lip") && normalized.includes("balm")) {
    return "Lip Balm Holders";
  }

  if (normalized.includes("custom")) {
    return "Custom Pieces";
  }

  if (normalized.includes("one-of-one") || normalized.includes("one of one")) {
    return "One-of-One";
  }

  return "Accessories";
}

export async function createProductDraft(input: unknown) {
  const parsed = productDraftSchema.parse(input);
  const db = getDb();
  const category = normalizeCategory(parsed.category);
  let productId: string | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const now = new Date();

    try {
      productId = await db.transaction(async (tx) => {
        const [insertedProduct] = await tx
          .insert(products)
          .values({
            sku: parsed.sku ?? (await generateSku(category, now)),
            title: parsed.title,
            slug: parsed.slug ?? `${generateSlug(parsed.title)}-${randomSuffix(4).toLowerCase()}`,
            description: parsed.description,
            shortDescription: parsed.shortDescription ?? null,
            category,
            subcategory: parsed.subcategory ?? null,
            price: toNumericValue(parsed.price) ?? "0.00",
            compareAtPrice: toNumericValue(parsed.compareAtPrice),
            costEstimate: toNumericValue(parsed.costEstimate),
            quantity: parsed.quantity,
            status: parsed.status ?? "draft",
            condition: parsed.condition,
            materials: parsed.materials,
            colors: parsed.colors,
            tags: parsed.tags,
            aiConfidence: toNumericValue(parsed.aiConfidence, 3),
            aiNotes: parsed.aiNotes ?? null,
            createdBy: parsed.createdBy ?? null,
            approvedBy: parsed.approvedBy ?? null,
            publishedAt: null,
            updatedAt: now
          })
          .returning({ id: products.id });

        if (parsed.images.length) {
          await tx.insert(productImages).values(
            parsed.images.map((image) => ({
              productId: insertedProduct.id,
              originalUrl: image.originalUrl,
              processedUrl: image.processedUrl ?? null,
              thumbnailUrl: image.thumbnailUrl ?? null,
              altText: image.altText ?? null,
              isPrimary: image.isPrimary,
              imageKind: image.imageKind
            }))
          );
        }

        if (parsed.aiGeneration) {
          await tx.insert(aiGenerations).values({
            productId: insertedProduct.id,
            inputImageUrl: parsed.aiGeneration.inputImageUrl,
            outputImageUrl: parsed.aiGeneration.outputImageUrl ?? null,
            model: parsed.aiGeneration.model,
            prompt: parsed.aiGeneration.prompt,
            rawResponse: parsed.aiGeneration.rawResponse,
            parsedResponse: parsed.aiGeneration.parsedResponse,
            status: parsed.aiGeneration.status,
            errorMessage: parsed.aiGeneration.errorMessage ?? null
          });
        }

        return insertedProduct.id;
      });

      break;
    } catch (error) {
      if (!isSkuConflict(error) || parsed.sku) {
        throw error;
      }
    }
  }

  if (!productId) {
    throw new Error("Failed to allocate a unique SKU.");
  }

  const product = await getProductById(productId);
  if (!product) {
    throw new Error("Failed to create product draft.");
  }

  return product;
}

export async function updateProductStatus(
  productId: string,
  status: ProductStatus,
  options?: {
    approvedBy?: string | null;
    publishedAt?: Date | null;
  }
) {
  const parsed = productStatusUpdateSchema.parse({
    productId,
    status,
    approvedBy: options?.approvedBy,
    publishedAt: options?.publishedAt
  });

  const db = getDb();
  await db
    .update(products)
    .set({
      status: parsed.status,
      approvedBy: parsed.approvedBy ?? null,
      publishedAt: parsed.publishedAt ?? null,
      updatedAt: new Date()
    })
    .where(eq(products.id, parsed.productId));

  return getProductById(parsed.productId);
}

export async function createPublishResult(input: {
  productId: string;
  mode: PublishMode;
  success: boolean;
  message: string;
  target?: string | null;
  payload?: unknown;
  response?: unknown;
}) {
  const db = getDb();

  const [result] = await db
    .insert(publishResults)
    .values({
      productId: input.productId,
      mode: input.mode,
      success: input.success,
      message: input.message,
      target: input.target ?? null,
      payload: input.payload,
      response: input.response
    })
    .returning();

  return result;
}

export async function updateProductReviewDraft(input: unknown, options?: { status?: ProductStatus }) {
  const parsed = productReviewUpdateSchema.parse(input);
  const db = getDb();
  const update: Partial<typeof products.$inferInsert> = {
    title: parsed.title,
    description: parsed.description,
    shortDescription: parsed.shortDescription ?? null,
    category: normalizeCategory(parsed.category),
    subcategory: parsed.subcategory ?? null,
    price: toNumericValue(parsed.price) ?? "0.00",
    compareAtPrice: toNumericValue(parsed.compareAtPrice ?? null),
    quantity: parsed.quantity,
    materials: parsed.materials,
    colors: parsed.colors,
    tags: parsed.tags,
    aiNotes: parsed.aiNotes ?? null,
    aiConfidence: toNumericValue(parsed.aiConfidence ?? null, 3),
    updatedAt: new Date()
  };

  if (options?.status) {
    update.status = options.status;
  }

  await db
    .update(products)
    .set(update)
    .where(eq(products.id, parsed.productId));

  return getProductById(parsed.productId);
}

export async function setPrimaryProductImage(input: { productId: string; imageId: string }) {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(productImages)
      .set({
        isPrimary: false
      })
      .where(eq(productImages.productId, input.productId));

    await tx
      .update(productImages)
      .set({
        isPrimary: true
      })
      .where(eq(productImages.id, input.imageId));

    await tx
      .update(products)
      .set({
        updatedAt: new Date()
      })
      .where(eq(products.id, input.productId));
  });

  return getProductById(input.productId);
}

export async function createProcessedProductImage(input: {
  productId: string;
  originalImageUrl: string;
  processedImageUrl: string;
  thumbnailUrl?: string | null;
  altText?: string | null;
  makePrimary?: boolean;
}) {
  const db = getDb();

  await db.transaction(async (tx) => {
    if (input.makePrimary ?? true) {
      await tx
        .update(productImages)
        .set({
          isPrimary: false
        })
        .where(eq(productImages.productId, input.productId));
    }

    await tx.insert(productImages).values({
      productId: input.productId,
      originalUrl: input.originalImageUrl,
      processedUrl: input.processedImageUrl,
      thumbnailUrl: input.thumbnailUrl ?? input.processedImageUrl,
      altText: input.altText ?? null,
      isPrimary: input.makePrimary ?? true,
      imageKind: "processed"
    });

    await tx
      .update(products)
      .set({
        updatedAt: new Date()
      })
      .where(eq(products.id, input.productId));
  });

  return getProductById(input.productId);
}

export async function createPendingCaptureDraft(input: {
  titleHint?: string | null;
  quantity?: number;
  notes?: string | null;
  originalImageUrl: string;
  aiModel: string;
  aiPrompt: string;
  stylePresetId?: string | null;
}) {
  const db = getDb();
  const now = new Date();
  const productTitle = input.titleHint?.trim() || "New product capture";
  const productSlug = `${generateSlug(productTitle)}-${randomSuffix(4).toLowerCase()}`;
  const productSku = await generateSku("Accessories", now);

  const [result] = await db.transaction(async (tx) => {
    const [insertedProduct] = await tx
      .insert(products)
      .values({
        sku: productSku,
        title: productTitle,
        slug: productSlug,
        description: input.notes?.trim() || "AI draft in progress.",
        shortDescription: "AI draft in progress.",
        category: "Accessories",
        subcategory: null,
        price: "0.00",
        compareAtPrice: null,
        costEstimate: null,
        quantity: input.quantity ?? 1,
        status: "draft",
        condition: "handmade",
        materials: [],
        colors: [],
        tags: [],
        aiConfidence: null,
        aiNotes: input.notes?.trim() || null,
        createdBy: "capture",
        approvedBy: null,
        publishedAt: null,
        updatedAt: now
      })
      .returning({ id: products.id });

    await tx.insert(productImages).values({
      productId: insertedProduct.id,
      originalUrl: input.originalImageUrl,
      processedUrl: null,
      thumbnailUrl: null,
      altText: productTitle,
      isPrimary: true,
      imageKind: "original"
    });

    const [insertedGeneration] = await tx
      .insert(aiGenerations)
      .values({
        productId: insertedProduct.id,
        stylePresetId: input.stylePresetId ?? null,
        inputImageUrl: input.originalImageUrl,
        outputImageUrl: null,
        model: input.aiModel,
        prompt: input.aiPrompt,
        rawResponse: null,
        parsedResponse: null,
        status: "pending",
        errorMessage: null
      })
      .returning({ id: aiGenerations.id });

    return [
      {
        productId: insertedProduct.id,
        generationId: insertedGeneration.id
      }
    ];
  });

  return result;
}

export async function finalizePendingCaptureDraft(input: {
  productId: string;
  generationId: string;
  title: string;
  description: string;
  shortDescription?: string | null;
  category: string;
  subcategory?: string | null;
  price?: number;
  quantity: number;
  materials: string[];
  colors: string[];
  tags: string[];
  aiConfidence?: number | null;
  aiNotes?: string | null;
  originalImageUrl: string;
  processedImageUrl?: string | null;
  thumbnailUrl?: string | null;
  aiModel: string;
  aiPrompt: string;
  stylePresetId?: string | null;
  rawResponse?: unknown;
  parsedResponse?: unknown;
}) {
  const db = getDb();
  const category = normalizeCategory(input.category);
  let finalized = false;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(products)
          .set({
            sku: await generateSku(category, now),
            slug: `${generateSlug(input.title)}-${randomSuffix(4).toLowerCase()}`,
            title: input.title,
            description: input.description,
            shortDescription: input.shortDescription ?? null,
            category,
            subcategory: input.subcategory ?? null,
            price: toNumericValue(input.price ?? 0) ?? "0.00",
            quantity: input.quantity,
            status: "review",
            condition: "handmade",
            materials: input.materials,
            colors: input.colors,
            tags: input.tags,
            aiConfidence: toNumericValue(input.aiConfidence ?? null, 3),
            aiNotes: input.aiNotes ?? null,
            updatedAt: now
          })
          .where(eq(products.id, input.productId));

        await tx
          .update(productImages)
          .set({
            altText: input.title,
            isPrimary: !input.processedImageUrl
          })
          .where(eq(productImages.productId, input.productId));

        if (input.processedImageUrl) {
          await tx.insert(productImages).values({
            productId: input.productId,
            originalUrl: input.originalImageUrl,
            processedUrl: input.processedImageUrl,
            thumbnailUrl: input.thumbnailUrl ?? input.processedImageUrl,
            altText: input.title,
            isPrimary: true,
            imageKind: "processed"
          });
        }

        await tx
          .update(aiGenerations)
          .set({
            outputImageUrl: input.processedImageUrl ?? null,
            model: input.aiModel,
            prompt: input.aiPrompt,
            stylePresetId: input.stylePresetId ?? null,
            rawResponse: input.rawResponse,
            parsedResponse: input.parsedResponse,
            status: "success",
            errorMessage: null
          })
          .where(eq(aiGenerations.id, input.generationId));
      });

      finalized = true;
      break;
    } catch (error) {
      if (!isSkuConflict(error)) {
        throw error;
      }
    }
  }

  if (!finalized) {
    throw new Error("Failed to allocate a unique SKU.");
  }

  const product = await getProductById(input.productId);
  if (!product) {
    throw new Error("Failed to finalize product draft.");
  }

  return product;
}

export async function failPendingCaptureDraft(input: {
  productId: string;
  generationId: string;
  errorMessage: string;
}) {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(aiGenerations)
      .set({
        status: "failed",
        errorMessage: input.errorMessage
      })
      .where(eq(aiGenerations.id, input.generationId));

    await tx
      .update(products)
      .set({
        aiNotes: input.errorMessage,
        updatedAt: new Date()
      })
      .where(eq(products.id, input.productId));
  });

  return getProductById(input.productId);
}

export async function createAiGenerationLog(input: {
  productId?: string | null;
  stylePresetId?: string | null;
  inputImageUrl: string;
  outputImageUrl?: string | null;
  model: string;
  prompt: string;
  rawResponse?: unknown;
  parsedResponse?: unknown;
  status?: "pending" | "success" | "failed";
  errorMessage?: string | null;
}) {
  const db = getDb();
  const [generation] = await db
    .insert(aiGenerations)
    .values({
      productId: input.productId ?? null,
      stylePresetId: input.stylePresetId ?? null,
      inputImageUrl: input.inputImageUrl,
      outputImageUrl: input.outputImageUrl ?? null,
      model: input.model,
      prompt: input.prompt,
      rawResponse: input.rawResponse,
      parsedResponse: input.parsedResponse,
      status: input.status ?? "pending",
      errorMessage: input.errorMessage ?? null
    })
    .returning();

  return generation;
}

export async function updateAiGenerationLog(input: {
  generationId: string;
  stylePresetId?: string | null;
  outputImageUrl?: string | null;
  model?: string;
  prompt?: string;
  rawResponse?: unknown;
  parsedResponse?: unknown;
  status?: "pending" | "success" | "failed";
  errorMessage?: string | null;
}) {
  const db = getDb();
  const update: {
    stylePresetId?: string | null;
    outputImageUrl?: string | null;
    model?: string;
    prompt?: string;
    rawResponse?: unknown;
    parsedResponse?: unknown;
    status?: "pending" | "success" | "failed";
    errorMessage?: string | null;
  } = {};

  if (input.stylePresetId !== undefined) {
    update.stylePresetId = input.stylePresetId;
  }
  if (input.outputImageUrl !== undefined) {
    update.outputImageUrl = input.outputImageUrl;
  }
  if (input.model !== undefined) {
    update.model = input.model;
  }
  if (input.prompt !== undefined) {
    update.prompt = input.prompt;
  }
  if (input.rawResponse !== undefined) {
    update.rawResponse = input.rawResponse;
  }
  if (input.parsedResponse !== undefined) {
    update.parsedResponse = input.parsedResponse;
  }
  if (input.status !== undefined) {
    update.status = input.status;
  }
  if (input.errorMessage !== undefined) {
    update.errorMessage = input.errorMessage;
  }

  const [generation] = await db
    .update(aiGenerations)
    .set(update)
    .where(eq(aiGenerations.id, input.generationId))
    .returning();

  return generation;
}

export async function saveStylePreset(input: unknown) {
  const parsed = stylePresetInputSchema.parse(input);
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    if (parsed.isDefault) {
      await tx.update(stylePresets).set({ isDefault: false, updatedAt: now });
    }

    if (parsed.presetId) {
      const [preset] = await tx
        .update(stylePresets)
        .set({
          name: parsed.name,
          description: parsed.description,
          backgroundPrompt: parsed.backgroundPrompt,
          lightingPrompt: parsed.lightingPrompt,
          shadowPrompt: parsed.shadowPrompt,
          cropRatio: parsed.cropRatio,
          outputSize: parsed.outputSize,
          exampleImageUrls: parsed.exampleImageUrls,
          isDefault: parsed.isDefault,
          updatedAt: now
        })
        .where(eq(stylePresets.id, parsed.presetId))
        .returning();

      return preset;
    }

    const [preset] = await tx
      .insert(stylePresets)
      .values({
        name: parsed.name,
        description: parsed.description,
        backgroundPrompt: parsed.backgroundPrompt,
        lightingPrompt: parsed.lightingPrompt,
        shadowPrompt: parsed.shadowPrompt,
        cropRatio: parsed.cropRatio,
        outputSize: parsed.outputSize,
        exampleImageUrls: parsed.exampleImageUrls,
        isDefault: parsed.isDefault
      })
      .returning();

    return preset;
  });
}

export async function setDefaultStylePreset(stylePresetId: string) {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx.update(stylePresets).set({ isDefault: false, updatedAt: now });

    const [preset] = await tx
      .update(stylePresets)
      .set({
        isDefault: true,
        updatedAt: now
      })
      .where(eq(stylePresets.id, stylePresetId))
      .returning();

    return preset;
  });
}
