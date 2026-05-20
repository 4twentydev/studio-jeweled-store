import { z } from "zod";
import {
  aiGenerationStatuses,
  imageKinds,
  productConditions,
  productStatuses
} from "@/db/schema";

export const productStatusSchema = z.enum(productStatuses);
export const productConditionSchema = z.enum(productConditions);
export const imageKindSchema = z.enum(imageKinds);
export const aiGenerationStatusSchema = z.enum(aiGenerationStatuses);

const priceInputSchema = z.coerce.number().finite().min(0);
const optionalPriceInputSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return value;
}, z.coerce.number().finite().min(0).nullable());

export const productInsertSchema = z.object({
  sku: z.string().trim().min(3).max(64),
  title: z.string().trim().min(1).max(256),
  slug: z.string().trim().min(1).max(256),
  description: z.string().trim().min(1),
  shortDescription: z.string().trim().max(280).nullable().optional(),
  category: z.string().trim().min(1).max(128),
  subcategory: z.string().trim().max(128).nullable().optional(),
  price: priceInputSchema,
  compareAtPrice: optionalPriceInputSchema,
  costEstimate: optionalPriceInputSchema,
  quantity: z.coerce.number().int().min(0).default(0),
  status: productStatusSchema.default("draft"),
  condition: productConditionSchema.default("handmade"),
  materials: z.array(z.string().trim().min(1)).default([]),
  colors: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  aiConfidence: z.coerce.number().min(0).max(1).nullable().optional(),
  aiNotes: z.string().trim().nullable().optional(),
  createdBy: z.string().trim().min(1).nullable().optional(),
  approvedBy: z.string().trim().min(1).nullable().optional(),
  publishedAt: z.date().nullable().optional()
});

export const productDraftSchema = productInsertSchema.omit({
  sku: true,
  slug: true,
  status: true,
  publishedAt: true
}).extend({
  sku: z.string().trim().min(3).max(64).optional(),
  slug: z.string().trim().min(1).max(256).optional(),
  status: productStatusSchema.optional(),
  images: z
    .array(
      z.object({
        originalUrl: z.string().url(),
        processedUrl: z.string().url().nullable().optional(),
        thumbnailUrl: z.string().url().nullable().optional(),
        altText: z.string().trim().nullable().optional(),
        isPrimary: z.boolean().default(false),
        imageKind: imageKindSchema.default("original")
      })
    )
    .default([]),
  aiGeneration: z
    .object({
      inputImageUrl: z.string().url(),
      outputImageUrl: z.string().url().nullable().optional(),
      model: z.string().trim().min(1),
      prompt: z.string().trim().min(1),
      rawResponse: z.unknown().optional(),
      parsedResponse: z.unknown().optional(),
      status: aiGenerationStatusSchema.default("success"),
      errorMessage: z.string().trim().nullable().optional()
    })
    .optional()
});

export const productStatusUpdateSchema = z.object({
  productId: z.string().uuid(),
  status: productStatusSchema,
  approvedBy: z.string().trim().min(1).nullable().optional(),
  publishedAt: z.date().nullable().optional()
});

const stringListSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string().trim().min(1)));

export const productReviewUpdateSchema = z.object({
  productId: z.string().uuid(),
  title: z.string().trim().min(1).max(256),
  description: z.string().trim().min(1),
  shortDescription: z.string().trim().max(280).nullable().optional(),
  category: z.string().trim().min(1).max(128),
  subcategory: z.string().trim().max(128).nullable().optional(),
  price: priceInputSchema,
  compareAtPrice: optionalPriceInputSchema,
  quantity: z.coerce.number().int().min(0),
  materials: stringListSchema.default([]),
  colors: stringListSchema.default([]),
  tags: stringListSchema.default([]),
  aiNotes: z.string().trim().nullable().optional(),
  aiConfidence: z.coerce.number().min(0).max(1).nullable().optional()
});

export const appSettingSchema = z.object({
  key: z.string().trim().min(1).max(128),
  value: z.unknown()
});

export const studioSettingsSchema = z.object({
  brandVoice: z.string().trim().min(10),
  defaultMarkupPercent: z.coerce.number().min(0),
  defaultCollection: z.string().trim().min(1),
  publishMode: z.string().trim().min(1)
});

export const productCategoriesSchema = z.array(z.string().trim().min(1));

const exampleImageUrlsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string().url()));

export const stylePresetInputSchema = z.object({
  presetId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(400),
  backgroundPrompt: z.string().trim().min(10),
  lightingPrompt: z.string().trim().min(10),
  shadowPrompt: z.string().trim().min(10),
  cropRatio: z.string().trim().min(3).max(20),
  outputSize: z.string().trim().min(3).max(20),
  exampleImageUrls: exampleImageUrlsSchema.default([]),
  isDefault: z.coerce.boolean().default(false)
});

export function toNumericValue(value: number | null | undefined, scale = 2) {
  return value === null || value === undefined ? null : value.toFixed(scale);
}
