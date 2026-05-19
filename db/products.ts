import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getProductById } from "@/db/queries";
import { products, productImages, aiGenerations, type ProductStatus } from "@/db/schema";
import {
  productDraftSchema,
  productStatusUpdateSchema,
  toNumericValue
} from "@/db/validators";

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

export function generateSku(title = "JWLD") {
  const base = title.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "JWLD";
  return `${base}-${randomSuffix(5)}`;
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
  const now = new Date();

  const productId = await db.transaction(async (tx) => {
    const [insertedProduct] = await tx
      .insert(products)
      .values({
        sku: parsed.sku ?? generateSku(parsed.title),
        title: parsed.title,
        slug: parsed.slug ?? `${generateSlug(parsed.title)}-${randomSuffix(4).toLowerCase()}`,
        description: parsed.description,
        shortDescription: parsed.shortDescription ?? null,
        category: normalizeCategory(parsed.category),
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
