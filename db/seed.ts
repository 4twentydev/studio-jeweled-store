import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings, stylePresets } from "@/db/schema";
import { defaultStudioSettings, STUDIO_SETTINGS_SETTING_KEY } from "@/lib/studio-settings";
import { DEFAULT_STYLE_PRESETS } from "@/lib/style-presets";

const defaultSettings = [
  {
    key: STUDIO_SETTINGS_SETTING_KEY,
    value: defaultStudioSettings
  }
] as const;

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

for (const preset of DEFAULT_STYLE_PRESETS) {
  const [existingPreset] = await db
    .select({ id: stylePresets.id })
    .from(stylePresets)
    .where(eq(stylePresets.name, preset.name))
    .limit(1);

  if (existingPreset) {
    continue;
  }

  await db.insert(stylePresets).values({
    ...preset,
    exampleImageUrls: [...preset.exampleImageUrls]
  });
}

console.log("Seed complete.");
