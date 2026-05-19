import { z } from "zod";

export const jwldProductCategories = [
  "Lighters",
  "Lighter Cases",
  "Containers",
  "Lip Balm Holders",
  "Accessories",
  "Custom Pieces",
  "One-of-One"
] as const;

export const productMetadataSchema = z.object({
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(jwldProductCategories),
  subcategory: z.string().min(1),
  price: z.number().finite().nonnegative(),
  compareAtPrice: z.number().finite().nonnegative().nullable(),
  quantity: z.number().int().nonnegative(),
  materials: z.array(z.string().min(1)).default([]),
  colors: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  altText: z.string().min(1),
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),
  confidence: z.number().min(0).max(1),
  notesForHuman: z.string().min(1)
});

export type ProductMetadata = z.infer<typeof productMetadataSchema>;
