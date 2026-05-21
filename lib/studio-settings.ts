import { z } from "zod";
import { publishModes } from "@/db/schema";
import { DEFAULT_STYLE_PRESETS } from "@/lib/style-presets";

export const studioUserRoles = ["admin", "creator", "reviewer"] as const;
export const exportFormats = ["csv", "json", "both"] as const;
export const outputSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"] as const;

export const studioUserRoleSchema = z.enum(studioUserRoles);
export const exportFormatSchema = z.enum(exportFormats);
export const outputSizeSchema = z.enum(outputSizes);

const stringListSchema = z.array(z.string().trim().min(1)).default([]);

export const brandVoiceSettingsSchema = z.object({
  productDescriptionPrompt: z.string().trim().min(20),
  defaultTone: z.string().trim().min(2).max(80),
  wordsToPrefer: stringListSchema,
  wordsToAvoid: stringListSchema,
  exampleProductDescriptions: stringListSchema
});

export const pricingRuleLineSchema = z.object({
  category: z.string().trim().min(1).max(120),
  value: z.number().finite().min(0)
});

export const complexityMultiplierSchema = z.object({
  label: z.string().trim().min(1).max(120),
  multiplier: z.number().finite().min(0.1).max(10)
});

export const imageStyleSettingsSchema = z.object({
  defaultStylePresetId: z.string().trim().min(1),
  outputSize: outputSizeSchema,
  backgroundPreference: z.string().trim().min(2).max(160),
  cropPreference: z.string().trim().min(2).max(80)
});

export const publishingSettingsSchema = z.object({
  publishMode: z.enum(publishModes),
  storeApiUrl: z.string().url().nullable(),
  exportFormat: exportFormatSchema,
  exportFilenamePrefix: z.string().trim().min(1).max(80),
  exportIncludeImages: z.boolean()
});

export const subcategoryRuleSchema = z.object({
  category: z.string().trim().min(1).max(120),
  subcategory: z.string().trim().min(1).max(120)
});

export const studioUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: studioUserRoleSchema
});

export const studioSettingsSchema = z
  .object({
    brandVoice: brandVoiceSettingsSchema,
    pricingRules: z.object({
      categoryBasePrices: z.array(pricingRuleLineSchema).min(1),
      complexityMultipliers: z.array(complexityMultiplierSchema).min(1),
      oneOfOneMarkupPercent: z.number().finite().min(0).max(1000),
      minimumPrice: z.number().finite().min(0),
      defaultCompareAtMarkupPercent: z.number().finite().min(0).max(1000)
    }),
    imageStyle: imageStyleSettingsSchema,
    publishing: publishingSettingsSchema,
    categories: z
      .object({
        categories: z.array(z.string().trim().min(1).max(120)).min(1),
        subcategories: z.array(subcategoryRuleSchema).default([])
      })
      .superRefine((value, ctx) => {
        const categorySet = new Set(value.categories);

        value.subcategories.forEach((entry, index) => {
          if (!categorySet.has(entry.category)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Subcategory "${entry.subcategory}" references unknown category "${entry.category}".`,
              path: ["subcategories", index, "category"]
            });
          }
        });
      }),
    users: z.array(studioUserSchema).default([])
  })
  .strict();

export type StudioSettings = z.infer<typeof studioSettingsSchema>;

export const STORE_API_KEY_SETTING_KEY = "storeApiKey";
export const STUDIO_SETTINGS_SETTING_KEY = "studioSettings";
export const STUDIO_SETTINGS_CACHE_TAG = "studio-settings";

export const defaultStudioSettings: StudioSettings = {
  brandVoice: {
    productDescriptionPrompt:
      "Write product descriptions for a boutique jewelry and accessories store. Focus on craftsmanship, materials, finish, collectibility, and how the piece feels in-hand without sounding generic.",
    defaultTone: "Elevated and tactile",
    wordsToPrefer: ["handmade", "polished", "collectible", "studio-finished"],
    wordsToAvoid: ["cheap", "perfect", "flawless", "mass-produced"],
    exampleProductDescriptions: [
      "Hand-finished statement lighter case with high-shine crystal detail, a weighty feel, and an elevated boutique finish.",
      "Compact accessory piece with tactile texture, polished metalwork, and a collector-minded presentation for daily carry."
    ]
  },
  pricingRules: {
    categoryBasePrices: [
      { category: "Lighters", value: 48 },
      { category: "Lighter Cases", value: 58 },
      { category: "Containers", value: 42 },
      { category: "Lip Balm Holders", value: 36 },
      { category: "Accessories", value: 32 },
      { category: "Custom Pieces", value: 72 },
      { category: "One-of-One", value: 120 }
    ],
    complexityMultipliers: [
      { label: "Simple", multiplier: 1 },
      { label: "Detailed", multiplier: 1.25 },
      { label: "Collector", multiplier: 1.5 }
    ],
    oneOfOneMarkupPercent: 30,
    minimumPrice: 24,
    defaultCompareAtMarkupPercent: 18
  },
  imageStyle: {
    defaultStylePresetId: DEFAULT_STYLE_PRESETS[0]?.name ?? "JWLD Clean Black",
    outputSize: "1024x1024",
    backgroundPreference: "Luxury studio backdrop with restrained contrast",
    cropPreference: "Centered catalog crop"
  },
  publishing: {
    publishMode: "export",
    storeApiUrl: null,
    exportFormat: "csv",
    exportFilenamePrefix: "jwld-store",
    exportIncludeImages: true
  },
  categories: {
    categories: [
      "Lighters",
      "Lighter Cases",
      "Containers",
      "Lip Balm Holders",
      "Accessories",
      "Custom Pieces",
      "One-of-One"
    ],
    subcategories: [
      { category: "Accessories", subcategory: "Bracelets" },
      { category: "Accessories", subcategory: "Rings" },
      { category: "Containers", subcategory: "Travel Tins" }
    ]
  },
  users: [
    { name: "Studio Admin", role: "admin" },
    { name: "Primary Creator", role: "creator" },
    { name: "Review Queue", role: "reviewer" }
  ]
};

export function toLineList(value: string[]) {
  return value.join("\n");
}

export function toExampleDescriptionBlocks(value: string[]) {
  return value.join("\n---\n");
}

export function toCategoryValueLines(value: Array<{ category: string; value: number }>) {
  return value.map((entry) => `${entry.category} | ${entry.value}`).join("\n");
}

export function toComplexityMultiplierLines(value: Array<{ label: string; multiplier: number }>) {
  return value.map((entry) => `${entry.label} | ${entry.multiplier}`).join("\n");
}

export function toSubcategoryLines(value: Array<{ category: string; subcategory: string }>) {
  return value.map((entry) => `${entry.category} | ${entry.subcategory}`).join("\n");
}

export function toUserLines(value: Array<{ name: string; role: (typeof studioUserRoles)[number] }>) {
  return value.map((entry) => `${entry.name} | ${entry.role}`).join("\n");
}
