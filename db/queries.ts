import { and, asc, desc, eq, inArray, like, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiGenerations,
  appSettings,
  publishResults,
  productImages,
  products,
  stylePresets,
  type ProductStatus,
  type Product
} from "@/db/schema";

export async function listProducts(options?: {
  status?: ProductStatus | ProductStatus[];
  category?: string;
  limit?: number;
}) {
  const db = getDb();
  const filters: SQL[] = [];

  if (options?.status) {
    if (Array.isArray(options.status)) {
      filters.push(inArray(products.status, options.status));
    } else {
      filters.push(eq(products.status, options.status));
    }
  }

  if (options?.category) {
    filters.push(eq(products.category, options.category));
  }

  return db.query.products.findMany({
    where: filters.length ? and(...filters) : undefined,
    with: {
      images: {
        orderBy: [desc(productImages.isPrimary), asc(productImages.createdAt)]
      }
    },
    orderBy: [desc(products.updatedAt)],
    limit: options?.limit
  });
}

export async function getProductById(productId: string) {
  const db = getDb();
  return db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      images: {
        orderBy: [desc(productImages.isPrimary), asc(productImages.createdAt)]
      },
      aiGenerations: {
        with: {
          stylePreset: true
        },
        orderBy: [desc(aiGenerations.createdAt)]
      },
      publishResults: {
        orderBy: [desc(publishResults.createdAt)],
        limit: 1
      }
    }
  });
}

export async function listProductsByIds(productIds: string[]) {
  if (!productIds.length) {
    return [];
  }

  const db = getDb();
  return db.query.products.findMany({
    where: inArray(products.id, productIds),
    with: {
      images: {
        orderBy: [desc(productImages.isPrimary), asc(productImages.createdAt)]
      },
      publishResults: {
        orderBy: [desc(publishResults.createdAt)],
        limit: 1
      }
    }
  });
}

export async function listSkusForDate(dateStamp: string) {
  const db = getDb();
  const prefix = `JWLD-%-${dateStamp}-%`;

  return db
    .select({ sku: products.sku })
    .from(products)
    .where(like(products.sku, prefix));
}

export async function getAiGenerationById(generationId: string) {
  const db = getDb();
  return db.query.aiGenerations.findFirst({
    where: eq(aiGenerations.id, generationId),
    with: {
      stylePreset: true
    }
  });
}

export async function listReviewQueue() {
  return listProducts({
    status: ["draft", "review", "approved"]
  });
}

export async function getPrimaryImage(productId: string) {
  const db = getDb();
  return db.query.productImages.findFirst({
    where: eq(productImages.productId, productId),
    orderBy: [desc(productImages.isPrimary), asc(productImages.createdAt)]
  });
}

export async function getAppSetting<T>(key: string) {
  const db = getDb();
  const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return (setting?.value ?? null) as T | null;
}

export async function upsertAppSetting<T>(key: string, value: T) {
  const db = getDb();
  const [setting] = await db.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.key, key)).limit(1);

  if (setting) {
    await db
      .update(appSettings)
      .set({
        value,
        updatedAt: new Date()
      })
      .where(eq(appSettings.id, setting.id));
    return;
  }

  await db.insert(appSettings).values({ key, value });
}

export async function listStylePresets() {
  const db = getDb();
  return db.query.stylePresets.findMany({
    orderBy: [desc(stylePresets.isDefault), asc(stylePresets.name)]
  });
}

export async function getStylePresetById(stylePresetId: string) {
  const db = getDb();
  return db.query.stylePresets.findFirst({
    where: eq(stylePresets.id, stylePresetId)
  });
}

export async function getDefaultStylePreset() {
  const db = getDb();
  return db.query.stylePresets.findFirst({
    where: eq(stylePresets.isDefault, true),
    orderBy: [asc(stylePresets.name)]
  });
}

export function productPriceAsNumber(product: Pick<Product, "price">) {
  return Number(product.price);
}
