import { getProductById, listProducts } from "@/db/queries";
import { createPublishResult, updateProductStatus } from "@/db/products";
import { env } from "@/lib/env";
import type { Product, ProductImage, PublishMode } from "@/db/schema";

export type PublishResult = {
  success: boolean;
  productId: string;
  mode: PublishMode;
  message: string;
  target?: string | null;
  payload?: unknown;
  response?: unknown;
  publishedAt?: Date;
};

type PublishableProduct = Product & {
  images: ProductImage[];
};

type ExportFormat = "json" | "csv";

function getPrimaryImage(product: PublishableProduct) {
  return (
    product.images.find((image) => image.isPrimary) ??
    product.images.find((image) => Boolean(image.processedUrl ?? image.thumbnailUrl ?? image.originalUrl)) ??
    null
  );
}

function getPrimaryImageUrl(product: PublishableProduct) {
  const image = getPrimaryImage(product);
  return image?.processedUrl ?? image?.thumbnailUrl ?? image?.originalUrl ?? null;
}

function getMissingPublishFields(product: PublishableProduct) {
  const checks = [
    ["title", Boolean(product.title.trim())],
    ["slug", Boolean(product.slug.trim())],
    ["description", Boolean(product.description.trim())],
    ["category", Boolean(product.category.trim())],
    ["price", Number.isFinite(Number(product.price))],
    ["primary image", Boolean(getPrimaryImageUrl(product))],
    ["quantity", Number.isInteger(product.quantity) && product.quantity >= 0]
  ] as const;

  return checks.filter(([, ok]) => !ok).map(([field]) => field);
}

function buildExportRecord(product: PublishableProduct) {
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    title: product.title,
    description: product.description,
    shortDescription: product.shortDescription,
    category: product.category,
    subcategory: product.subcategory,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    quantity: product.quantity,
    condition: product.condition,
    materials: product.materials,
    colors: product.colors,
    tags: product.tags,
    primaryImageUrl: getPrimaryImageUrl(product),
    publishedAt: product.publishedAt?.toISOString() ?? null,
    updatedAt: product.updatedAt.toISOString()
  };
}

function escapeCsvValue(value: string | number | null) {
  const stringValue = value === null ? "" : String(value);

  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function buildCsvExport(records: ReturnType<typeof buildExportRecord>[]) {
  const header = [
    "id",
    "sku",
    "slug",
    "title",
    "description",
    "shortDescription",
    "category",
    "subcategory",
    "price",
    "compareAtPrice",
    "quantity",
    "condition",
    "materials",
    "colors",
    "tags",
    "primaryImageUrl",
    "publishedAt",
    "updatedAt"
  ];

  const rows = records.map((record) => [
    record.id,
    record.sku,
    record.slug,
    record.title,
    record.description,
    record.shortDescription,
    record.category,
    record.subcategory,
    record.price.toFixed(2),
    record.compareAtPrice === null ? null : record.compareAtPrice.toFixed(2),
    record.quantity,
    record.condition,
    record.materials.join("|"),
    record.colors.join("|"),
    record.tags.join("|"),
    record.primaryImageUrl,
    record.publishedAt,
    record.updatedAt
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
}

export async function getApprovedProductsForExport(productIds?: string[]) {
  const products = await listProducts({
    status: "approved",
    limit: productIds?.length
  });

  return products.filter((product) => !productIds?.length || productIds.includes(product.id));
}

export async function buildApprovedProductsExport(options?: {
  productIds?: string[];
  format?: ExportFormat;
}) {
  const format = options?.format ?? "json";
  const products = await getApprovedProductsForExport(options?.productIds);
  const records = products.map(buildExportRecord);

  return {
    format,
    records,
    content: format === "csv" ? buildCsvExport(records) : JSON.stringify(records, null, 2)
  };
}

export interface Publisher {
  publishProduct(productId: string): Promise<PublishResult>;
}

async function getApprovedProductOrThrow(productId: string) {
  const product = await getProductById(productId);

  if (!product || product.status !== "approved") {
    throw new Error("Only approved products can be published.");
  }

  const missingFields = getMissingPublishFields(product);
  if (missingFields.length) {
    throw new Error(`Missing required publish fields: ${missingFields.join(", ")}.`);
  }

  return product;
}

export const sharedDbPublisher: Publisher = {
  async publishProduct(productId) {
    const product = await getApprovedProductOrThrow(productId);

    return {
      success: false,
      productId,
      mode: "shared_db",
      message: "TODO: map JWLD Studio products into the shared JWLD.store products table.",
      target: "shared products table",
      payload: buildExportRecord(product)
    };
  }
};

export const apiPublisher: Publisher = {
  async publishProduct(productId) {
    const product = await getApprovedProductOrThrow(productId);

    return {
      success: false,
      productId,
      mode: "api_push",
      message: "TODO: push approved products into the JWLD.store publish API.",
      target: env.JWLD_STORE_API_URL ?? null,
      payload: buildExportRecord(product)
    };
  }
};

export const exportPublisher: Publisher = {
  async publishProduct(productId) {
    const product = await getApprovedProductOrThrow(productId);
    const payload = buildExportRecord(product);

    return {
      success: true,
      productId,
      mode: "export",
      message: "Product prepared for manual export/import into JWLD.store.",
      target: "/inventory/export?approvedOnly=true&format=json",
      payload,
      response: {
        formats: ["json", "csv"]
      }
    };
  }
};

function getPublisherForMode(mode: PublishMode) {
  switch (mode) {
    case "shared_db":
      return sharedDbPublisher;
    case "api_push":
      return apiPublisher;
    case "export":
    default:
      return exportPublisher;
  }
}

export async function publishProduct(productId: string): Promise<PublishResult> {
  const mode = env.JWLD_PUBLISH_MODE;
  const publisher = getPublisherForMode(mode);
  let result: PublishResult;

  try {
    result = await publisher.publishProduct(productId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publishing failed.";

    await createPublishResult({
      productId,
      mode,
      success: false,
      message
    });

    throw error;
  }

  await createPublishResult({
    productId,
    mode: result.mode,
    success: result.success,
    message: result.message,
    target: result.target ?? null,
    payload: result.payload,
    response: result.response
  });

  if (!result.success) {
    throw new Error(result.message);
  }

  const publishedAt = new Date();
  await updateProductStatus(productId, "published", {
    publishedAt
  });

  return {
    ...result,
    publishedAt
  };
}
