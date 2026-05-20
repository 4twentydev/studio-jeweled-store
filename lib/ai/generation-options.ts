import { z } from "zod";

export const creativityLevels = ["low", "medium", "high"] as const;
export const descriptionTones = [
  "clean luxury",
  "playful boutique",
  "bold and edgy",
  "simple catalog"
] as const;
export const priceStrategies = ["budget", "standard", "premium", "one-of-one"] as const;
export const regenerationScopes = ["all", "image", "title_description", "price", "category_tags"] as const;

export const generationOptionsSchema = z.object({
  scope: z.enum(regenerationScopes).default("all"),
  creativity: z.enum(creativityLevels).default("medium"),
  descriptionTone: z.enum(descriptionTones).default("clean luxury"),
  priceStrategy: z.enum(priceStrategies).default("standard"),
  humanInstruction: z.string().trim().max(500).nullable().default(null),
  stylePresetId: z.string().uuid().nullable().default(null)
});

export type GenerationOptions = z.infer<typeof generationOptionsSchema>;
