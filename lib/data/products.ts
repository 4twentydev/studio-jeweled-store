import { hasDatabase } from "@/db";
import { saveStylePreset } from "@/db/products";
import { formatPrice, INITIAL_CATEGORIES } from "@/db/products";
import {
  getAppSetting,
  getDefaultStylePreset,
  getProductById,
  listProducts,
  listReviewQueue,
  listStylePresets,
  productPriceAsNumber
} from "@/db/queries";
import { productStatuses, type ProductStatus } from "@/db/schema";
import { demoInventory, demoSettings } from "@/lib/demo-data";
import type { GenerationOptions } from "@/lib/ai/generation-options";
import { parseGenerationReviewSnapshot } from "@/lib/ai/generation-history";
import { DEFAULT_STYLE_PRESETS } from "@/lib/style-presets";

const LOW_STOCK_THRESHOLD = 3;

export type InventorySort = "newest" | "oldest" | "price_high" | "price_low" | "category" | "quantity";
export type InventoryQuantityFilter = "all" | "out" | "low" | "in";
export type InventoryPublishedFilter = "all" | "published" | "unpublished";
export type InventoryAvailabilityFilter = "all" | "sold" | "available";

export type InventoryFilters = {
  q?: string;
  status?: string;
  category?: string;
  quantity?: string;
  published?: string;
  availability?: string;
  sort?: string;
};

export type InventoryListItem = {
  id: string;
  sku: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string | null;
  tags: string[];
  category: string;
  subcategory: string | null;
  collection: string;
  priceCents: number;
  quantityOnHand: number;
  status: ProductStatus;
  styledImageUrl: string;
  aiConfidence: number | null;
  aiNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  isPublished: boolean;
  isSold: boolean;
  hasMetadataGaps: boolean;
};

export type InventoryStats = {
  totalProducts: number;
  drafts: number;
  approved: number;
  published: number;
  sold: number;
  lowQuantity: number;
  estimatedInventoryValueCents: number;
};

function buildDemoDate(offsetDays: number) {
  return new Date(Date.UTC(2026, 4, 19 - offsetDays, 16, 0, 0));
}

function formatPublishResultMessage(
  result:
    | {
        mode: "shared_db" | "api_push" | "export";
        message: string;
        target: string | null;
        success: boolean;
        createdAt: Date;
      }
    | null
) {
  if (!result) {
    return null;
  }

  return {
    ...result,
    modeLabel: result.mode.replace("_", " "),
    createdAtLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(result.createdAt)
  };
}

function toInventoryCard(item: Awaited<ReturnType<typeof listProducts>>[number]): InventoryListItem {
  const primaryImage = item.images[0];
  const priceCents = Math.round(productPriceAsNumber(item) * 100);
  const isPublished = item.status === "published";
  const isSold = item.status === "sold" || item.quantity === 0;

  return {
    id: item.id,
    sku: item.sku,
    slug: item.slug,
    title: item.title,
    description: item.description,
    shortDescription: item.shortDescription,
    tags: item.tags,
    category: item.category,
    subcategory: item.subcategory,
    collection: item.subcategory ?? item.category,
    priceCents,
    quantityOnHand: item.quantity,
    status: item.status,
    aiConfidence: item.aiConfidence === null ? null : Number(item.aiConfidence),
    aiNotes: item.aiNotes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
    isPublished,
    isSold,
    hasMetadataGaps:
      !item.shortDescription ||
      item.tags.length === 0 ||
      item.materials.length === 0 ||
      item.aiConfidence === null,
    styledImageUrl:
      primaryImage?.processedUrl ?? primaryImage?.thumbnailUrl ?? primaryImage?.originalUrl ?? "/placeholder.png"
  };
}

function toDemoInventoryCard(
  item: (typeof demoInventory)[number],
  index: number
): InventoryListItem {
  const createdAt = buildDemoDate(index + 9);
  const updatedAt = buildDemoDate(index + 1);
  const isPublished = item.status === "published";
  const isSold = item.status === "sold" || item.quantityOnHand === 0;

  return {
    id: item.id,
    sku: item.sku,
    slug: item.slug,
    title: item.title,
    description: item.description,
    shortDescription: item.description.slice(0, 120),
    tags: item.tags,
    category: item.category,
    subcategory: item.collection,
    collection: item.collection,
    priceCents: item.priceCents,
    quantityOnHand: item.quantityOnHand,
    status: item.status,
    styledImageUrl: item.styledImageUrl,
    aiConfidence: null,
    aiNotes: "Demo inventory item.",
    createdAt,
    updatedAt,
    publishedAt: isPublished ? updatedAt : null,
    isPublished,
    isSold,
    hasMetadataGaps: item.tags.length < 3
  };
}

function normalizeSearchValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function formatInventoryStatus(status: ProductStatus) {
  return status.replaceAll("_", " ");
}

function getInventoryStats(items: InventoryListItem[]): InventoryStats {
  return {
    totalProducts: items.length,
    drafts: items.filter((item) => item.status === "draft").length,
    approved: items.filter((item) => item.status === "approved").length,
    published: items.filter((item) => item.status === "published").length,
    sold: items.filter((item) => item.isSold).length,
    lowQuantity: items.filter((item) => item.quantityOnHand <= LOW_STOCK_THRESHOLD).length,
    estimatedInventoryValueCents: items.reduce(
      (sum, item) => sum + item.priceCents * Math.max(item.quantityOnHand, 0),
      0
    )
  };
}

function getSortValue(filters: InventoryFilters): InventorySort {
  const sort = filters.sort;

  if (
    sort === "oldest" ||
    sort === "price_high" ||
    sort === "price_low" ||
    sort === "category" ||
    sort === "quantity"
  ) {
    return sort;
  }

  return "newest";
}

function getQuantityFilterValue(filters: InventoryFilters): InventoryQuantityFilter {
  const quantity = filters.quantity;
  return quantity === "out" || quantity === "low" || quantity === "in" ? quantity : "all";
}

function getPublishedFilterValue(filters: InventoryFilters): InventoryPublishedFilter {
  const published = filters.published;
  return published === "published" || published === "unpublished" ? published : "all";
}

function getAvailabilityFilterValue(filters: InventoryFilters): InventoryAvailabilityFilter {
  const availability = filters.availability;
  return availability === "sold" || availability === "available" ? availability : "all";
}

function filterInventoryItems(items: InventoryListItem[], filters: InventoryFilters) {
  const query = normalizeSearchValue(filters.q);
  const status = filters.status && productStatuses.includes(filters.status as ProductStatus) ? filters.status : "all";
  const category = filters.category?.trim() || "all";
  const quantityFilter = getQuantityFilterValue(filters);
  const publishedFilter = getPublishedFilterValue(filters);
  const availabilityFilter = getAvailabilityFilterValue(filters);

  return items.filter((item) => {
    if (query) {
      const haystack = [item.sku, item.title, item.category, item.collection, item.tags.join(" ")]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (status !== "all" && item.status !== status) {
      return false;
    }

    if (category !== "all" && item.category !== category) {
      return false;
    }

    if (quantityFilter === "out" && item.quantityOnHand !== 0) {
      return false;
    }

    if (quantityFilter === "low" && (item.quantityOnHand === 0 || item.quantityOnHand > LOW_STOCK_THRESHOLD)) {
      return false;
    }

    if (quantityFilter === "in" && item.quantityOnHand <= LOW_STOCK_THRESHOLD) {
      return false;
    }

    if (publishedFilter === "published" && !item.isPublished) {
      return false;
    }

    if (publishedFilter === "unpublished" && item.isPublished) {
      return false;
    }

    if (availabilityFilter === "sold" && !item.isSold) {
      return false;
    }

    if (availabilityFilter === "available" && item.isSold) {
      return false;
    }

    return true;
  });
}

function sortInventoryItems(items: InventoryListItem[], sort: InventorySort) {
  return [...items].sort((left, right) => {
    switch (sort) {
      case "oldest":
        return left.createdAt.getTime() - right.createdAt.getTime();
      case "price_high":
        return right.priceCents - left.priceCents;
      case "price_low":
        return left.priceCents - right.priceCents;
      case "category":
        return left.category.localeCompare(right.category) || left.title.localeCompare(right.title);
      case "quantity":
        return right.quantityOnHand - left.quantityOnHand || left.title.localeCompare(right.title);
      case "newest":
      default:
        return right.createdAt.getTime() - left.createdAt.getTime();
    }
  });
}

export async function getDashboardData() {
  if (!hasDatabase()) {
    const inventory = demoInventory.map(toDemoInventoryCard);

    return {
      metrics: {
        itemsInInventory: inventory.length,
        readyForReview: inventory.filter((item) => item.status === "review").length,
        lowStockCount: inventory.filter((item) => item.quantityOnHand <= LOW_STOCK_THRESHOLD).length,
        publishReady: inventory.filter((item) => item.status === "approved").length,
        newCapturesToday: 4,
        aiProcessedToday: 3,
        publishedToday: 1
      },
      reviewQueue: inventory.map((item) => ({
        ...item,
        statusLabel: formatInventoryStatus(item.status),
        inventoryStatus: `${item.quantityOnHand} on hand`
      })),
      lowStock: inventory.filter((item) => item.quantityOnHand <= LOW_STOCK_THRESHOLD)
    };
  }

  const inventory = (await listProducts({ limit: 12 })).map(toInventoryCard);

  return {
    metrics: {
      itemsInInventory: inventory.length,
      readyForReview: inventory.filter((item) => item.status === "review").length,
      lowStockCount: inventory.filter((item) => item.quantityOnHand <= LOW_STOCK_THRESHOLD).length,
      publishReady: inventory.filter((item) => item.status === "approved").length,
      newCapturesToday: 0,
      aiProcessedToday: 0,
      publishedToday: 0
    },
    reviewQueue: inventory
      .filter((item) => item.status !== "published")
      .map((item) => ({
        ...item,
        statusLabel: formatInventoryStatus(item.status),
        inventoryStatus: `${item.quantityOnHand} on hand`
      })),
    lowStock: inventory.filter((item) => item.quantityOnHand <= LOW_STOCK_THRESHOLD)
  };
}

export async function getInventoryData() {
  if (!hasDatabase()) {
    return demoInventory.map(toDemoInventoryCard);
  }

  return (await listProducts()).map(toInventoryCard);
}

export async function getInventoryPageData(filters: InventoryFilters) {
  const items = await getInventoryData();
  const filteredItems = filterInventoryItems(items, filters);
  const sortedItems = sortInventoryItems(filteredItems, getSortValue(filters));

  return {
    items: sortedItems,
    stats: getInventoryStats(items),
    categories: [...new Set(items.map((item) => item.category))].sort((left, right) => left.localeCompare(right)),
    appliedFilters: {
      q: filters.q?.trim() ?? "",
      status:
        filters.status && productStatuses.includes(filters.status as ProductStatus) ? filters.status : "all",
      category: filters.category?.trim() || "all",
      quantity: getQuantityFilterValue(filters),
      published: getPublishedFilterValue(filters),
      availability: getAvailabilityFilterValue(filters),
      sort: getSortValue(filters)
    },
    totalItems: items.length,
    filteredCount: sortedItems.length,
    lowStockThreshold: LOW_STOCK_THRESHOLD
  };
}

export async function getReviewQueue() {
  if (!hasDatabase()) {
    return demoInventory
      .map(toDemoInventoryCard)
      .filter((item) => item.status !== "published")
      .map((item) => ({
        ...item,
        statusLabel: formatInventoryStatus(item.status),
        aiConfidencePercent: null,
        createdDateLabel: "Demo"
      }));
  }

  const queue = (await listReviewQueue()).map(toInventoryCard);

  return queue.map((item) => ({
    ...item,
    statusLabel: formatInventoryStatus(item.status),
    aiConfidencePercent: item.aiConfidence === null ? null : Math.round(item.aiConfidence * 100),
    createdDateLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric"
    }).format(item.createdAt)
  }));
}

export async function getReviewProduct(productId: string) {
  if (!hasDatabase()) {
    return null;
  }

  const product = await getProductById(productId);
  if (!product) {
    return null;
  }

  const primaryImage = product.images[0] ?? null;
  const originalImage =
    product.images.find((image) => image.imageKind === "original") ?? primaryImage ?? null;
  const processedImage =
    product.images.find((image) => image.processedUrl) ?? primaryImage ?? originalImage ?? null;
  const selectedFinalGeneration =
    product.aiGenerations.find((generation) => generation.isSelectedFinal) ??
    product.aiGenerations.find((generation) => generation.status === "success") ??
    null;

  return {
    ...product,
    priceValue: productPriceAsNumber(product),
    compareAtPriceValue: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    aiConfidencePercent: product.aiConfidence === null ? null : Math.round(Number(product.aiConfidence) * 100),
    originalImage,
    processedImage,
    primaryImage,
    selectedFinalGeneration,
    aiGenerations: product.aiGenerations.map((generation) => ({
      ...generation,
      options: (generation.options ?? null) as GenerationOptions | null,
      reviewSnapshot: parseGenerationReviewSnapshot(generation.parsedResponse)
    })),
    latestPublishResult: formatPublishResultMessage(product.publishResults[0] ?? null),
    createdDateLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(product.createdAt)
  };
}

export async function getInventoryProduct(productId: string) {
  if (!hasDatabase()) {
    const demoProduct = demoInventory.map(toDemoInventoryCard).find((item) => item.id === productId);

    if (!demoProduct) {
      return null;
    }

    return {
      ...demoProduct,
      priceValue: demoProduct.priceCents / 100,
      compareAtPriceValue: null,
      materials: demoProduct.tags.slice(0, 2),
      colors: [],
      images: [
        {
          id: `${demoProduct.id}-primary`,
          originalUrl: demoProduct.styledImageUrl,
          processedUrl: demoProduct.styledImageUrl,
          thumbnailUrl: demoProduct.styledImageUrl,
          altText: demoProduct.title,
          imageKind: "processed" as const,
          isPrimary: true,
          createdAt: demoProduct.createdAt
        }
      ],
      aiGenerations: [
        {
          id: `${demoProduct.id}-demo-generation`,
          model: "Demo",
          prompt: "Demo AI generation history entry",
          status: "success" as const,
          errorMessage: null,
          createdAt: demoProduct.updatedAt,
          stylePreset: DEFAULT_STYLE_PRESETS.find((preset) => preset.isDefault) ?? DEFAULT_STYLE_PRESETS[0]
        }
      ],
      latestPublishResult: null
    };
  }

  const product = await getProductById(productId);
  if (!product) {
    return null;
  }

  const mapped = toInventoryCard(product);

  return {
    ...mapped,
    shortDescription: product.shortDescription,
    subcategory: product.subcategory,
    compareAtPriceValue: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    priceValue: productPriceAsNumber(product),
    materials: product.materials,
    colors: product.colors,
    images: product.images,
    aiGenerations: product.aiGenerations,
    latestPublishResult: formatPublishResultMessage(product.publishResults[0] ?? null)
  };
}

export async function getSettingsSnapshot() {
  if (!hasDatabase()) {
    return demoSettings;
  }

  const [brandVoice, defaultMarkupPercent, defaultCollection, publishMode] = await Promise.all([
    getAppSetting<string>("brandVoice"),
    getAppSetting<number>("defaultMarkupPercent"),
    getAppSetting<string>("defaultCollection"),
    getAppSetting<string>("publishMode")
  ]);

  return {
    brandVoice: brandVoice ?? demoSettings.brandVoice,
    defaultMarkupPercent: defaultMarkupPercent ?? demoSettings.defaultMarkupPercent,
    defaultCollection: defaultCollection ?? demoSettings.defaultCollection,
    publishMode: publishMode ?? demoSettings.publishMode,
    categories: (await getAppSetting<string[]>("productCategories")) ?? [...INITIAL_CATEGORIES],
    currencyPreview: formatPrice(125)
  };
}

export async function getStylePresetsData() {
  if (!hasDatabase()) {
    return {
      presets: DEFAULT_STYLE_PRESETS.map((preset, index) => ({
        id: `demo-style-preset-${index + 1}`,
        ...preset
      })),
      defaultPresetId: "demo-style-preset-1"
    };
  }

  let presets = await listStylePresets();

  if (presets.length === 0) {
    for (const preset of DEFAULT_STYLE_PRESETS) {
      await saveStylePreset({
        ...preset,
        presetId: null
      });
    }

    presets = await listStylePresets();
  }

  const defaultPreset = presets.find((preset) => preset.isDefault) ?? (await getDefaultStylePreset()) ?? presets[0];

  return {
    presets,
    defaultPresetId: defaultPreset?.id ?? null
  };
}

export async function getDefaultStylePresetForGeneration() {
  if (!hasDatabase()) {
    const demoDefaultPreset = DEFAULT_STYLE_PRESETS.find((preset) => preset.isDefault) ?? DEFAULT_STYLE_PRESETS[0];

    return {
      id: "demo-style-preset-1",
      ...demoDefaultPreset
    };
  }

  const { presets, defaultPresetId } = await getStylePresetsData();
  return presets.find((preset) => preset.id === defaultPresetId) ?? presets[0] ?? null;
}
