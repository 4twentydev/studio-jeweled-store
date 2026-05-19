import { desc, eq, inArray } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { products, studioSettings } from "@/db/schema";
import { demoInventory, demoSettings } from "@/lib/demo-data";

export async function getDashboardData() {
  if (!hasDatabase()) {
    return {
      metrics: {
        itemsInInventory: demoInventory.length,
        readyForReview: demoInventory.filter((item) => item.status === "ready_for_review").length,
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

  const db = getDb();
  const inventory = await db.select().from(products).orderBy(desc(products.updatedAt)).limit(12);

  return {
    metrics: {
      itemsInInventory: inventory.length,
      readyForReview: inventory.filter((item) => item.status === "ready_for_review").length,
      lowStockCount: inventory.filter((item) => item.quantityOnHand <= item.reorderThreshold).length,
      publishReady: inventory.filter((item) => item.status === "approved").length,
      newCapturesToday: inventory.filter((item) => isToday(item.createdAt)).length,
      aiProcessedToday: inventory.filter((item) => Boolean(item.aiModel) && isToday(item.updatedAt)).length,
      publishedToday: inventory.filter((item) => item.publishedAt && isToday(item.publishedAt)).length
    },
    reviewQueue: inventory
      .filter((item) => item.status !== "published")
      .map((item) => ({
        ...item,
        statusLabel: item.status.replaceAll("_", " "),
        inventoryStatus: `${item.quantityOnHand} on hand`
      })),
    lowStock: inventory.filter((item) => item.quantityOnHand <= item.reorderThreshold)
  };
}

export async function getInventoryData() {
  if (!hasDatabase()) {
    return demoInventory;
  }

  const db = getDb();
  return db.select().from(products).orderBy(desc(products.updatedAt));
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

  const db = getDb();
  const queue = await db
    .select()
    .from(products)
    .where(inArray(products.status, ["draft", "ready_for_review", "approved"]))
    .orderBy(desc(products.updatedAt));

  return queue.map((item) => ({
    ...item,
    statusLabel: item.status.replaceAll("_", " ")
  }));
}

export async function getSettingsSnapshot() {
  if (!hasDatabase()) {
    return demoSettings;
  }

  const db = getDb();
  const [settings] = await db.select().from(studioSettings).where(eq(studioSettings.id, "default")).limit(1);
  return settings ?? demoSettings;
}

function isToday(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}
