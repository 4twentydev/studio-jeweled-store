import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, stylePresets } from "@/db/schema";

const initialCategories = [
  "Lighters",
  "Lighter Cases",
  "Containers",
  "Lip Balm Holders",
  "Accessories",
  "Custom Pieces",
  "One-of-One"
] as const;

const defaultSettings = [
  {
    key: "brandVoice",
    value:
      "Elegant, intimate, and quietly luxurious. Focus on handmade craftsmanship, tactile materials, and collectible character."
  },
  {
    key: "defaultMarkupPercent",
    value: 62
  },
  {
    key: "defaultCollection",
    value: "Core"
  },
  {
    key: "publishMode",
    value: "Manual review required"
  },
  {
    key: "productCategories",
    value: [...initialCategories]
  }
] as const;

const defaultPreset = {
  name: "JWLD Clean Catalog",
  description: "Default studio preset for clean, product-forward ecommerce imagery.",
  backgroundPrompt: "Neutral luxury backdrop with subtle depth and no visual clutter.",
  lightingPrompt: "Soft diffused studio light with crisp detail and accurate metal color.",
  cropRatio: "4:5",
  outputSize: "1536x1920",
  exampleImageUrls: [],
  isDefault: true
} as const;

const db = getDb();

for (const setting of defaultSettings) {
  const [existing] = await db.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.key, setting.key)).limit(1);

  if (existing) {
    await db
      .update(appSettings)
      .set({
        value: setting.value,
        updatedAt: new Date()
      })
      .where(eq(appSettings.id, existing.id));
    continue;
  }

  await db.insert(appSettings).values(setting);
}

await db.insert(stylePresets).values(defaultPreset).onConflictDoNothing({ target: stylePresets.name });

console.log("Seed complete.");
