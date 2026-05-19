import { hasDatabase } from "@/db";
import { formatPrice, INITIAL_CATEGORIES } from "@/db/products";
import { getAppSetting, listProducts, listReviewQueue, productPriceAsNumber } from "@/db/queries";
import { demoInventory, demoSettings } from "@/lib/demo-data";

function toInventoryCard(item: Awaited<ReturnType<typeof listProducts>>[number]) {
  const primaryImage = item.images[0];
  const priceCents = Math.round(productPriceAsNumber(item) * 100);

  return {
    id: item.id,
    sku: item.sku,
    slug: item.slug,
    title: item.title,
    description: item.description,
    tags: item.tags,
    category: item.category,
    collection: item.subcategory ?? item.category,
    priceCents,
    quantityOnHand: item.quantity,
    status: item.status,
    styledImageUrl:
      primaryImage?.processedUrl ?? primaryImage?.thumbnailUrl ?? primaryImage?.originalUrl ?? "/placeholder.png"
  };
}

export async function getDashboardData() {
  if (!hasDatabase()) {
    return {
      metrics: {
        itemsInInventory: demoInventory.length,
        readyForReview: demoInventory.filter((item) => item.status === "review").length,
        lowStockCount: demoInventory.filter((item) => item.quantityOnHand <= 3).length,
        publishReady: demoInventory.filter((item) => item.status === "approved").length,
        newCapturesToday: 4,
        aiProcessedToday: 3,
        publishedToday: 1
      },
      reviewQueue: demoInventory.map((item) => ({
        ...item,
        statusLabel: item.status.replaceAll("_", " "),
        inventoryStatus: `${item.quantityOnHand} on hand`
      })),
      lowStock: demoInventory.filter((item) => item.quantityOnHand <= 3)
    };
  }

  const inventory = (await listProducts({ limit: 12 })).map(toInventoryCard);

  return {
    metrics: {
      itemsInInventory: inventory.length,
      readyForReview: inventory.filter((item) => item.status === "review").length,
      lowStockCount: inventory.filter((item) => item.quantityOnHand <= 3).length,
      publishReady: inventory.filter((item) => item.status === "approved").length,
      newCapturesToday: 0,
      aiProcessedToday: 0,
      publishedToday: 0
    },
    reviewQueue: inventory
      .filter((item) => item.status !== "published")
      .map((item) => ({
        ...item,
        statusLabel: item.status.replaceAll("_", " "),
        inventoryStatus: `${item.quantityOnHand} on hand`
      })),
    lowStock: inventory.filter((item) => item.quantityOnHand <= 3)
  };
}

export async function getInventoryData() {
  if (!hasDatabase()) {
    return demoInventory;
  }

  return (await listProducts()).map(toInventoryCard);
}

export async function getReviewQueue() {
  if (!hasDatabase()) {
    return demoInventory
      .filter((item) => item.status !== "published")
      .map((item) => ({
        ...item,
        statusLabel: item.status.replaceAll("_", " ")
      }));
  }

  const queue = (await listReviewQueue()).map(toInventoryCard);

  return queue.map((item) => ({
    ...item,
    statusLabel: item.status.replaceAll("_", " ")
  }));
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
