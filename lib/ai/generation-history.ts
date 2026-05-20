import type { Product } from "@/db/schema";

export type GenerationMetadataSnapshot = {
  title: string;
  description: string;
  shortDescription: string | null;
  category: string;
  subcategory: string | null;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  materials: string[];
  colors: string[];
  tags: string[];
  aiNotes: string | null;
  aiConfidence: number | null;
};

export type GenerationImageSnapshot = {
  originalImageUrl: string | null;
  processedImageUrl: string | null;
  cleanBackgroundImageUrl: string | null;
  variant: "primary" | "clean-background" | null;
};

export type GenerationReviewSnapshot = {
  metadata: GenerationMetadataSnapshot | null;
  images: GenerationImageSnapshot | null;
};

export function buildMetadataSnapshot(product: Pick<
  Product,
  | "title"
  | "description"
  | "shortDescription"
  | "category"
  | "subcategory"
  | "price"
  | "compareAtPrice"
  | "quantity"
  | "materials"
  | "colors"
  | "tags"
  | "aiNotes"
  | "aiConfidence"
>): GenerationMetadataSnapshot {
  return {
    title: product.title,
    description: product.description,
    shortDescription: product.shortDescription ?? null,
    category: product.category,
    subcategory: product.subcategory ?? null,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    quantity: product.quantity,
    materials: [...product.materials],
    colors: [...product.colors],
    tags: [...product.tags],
    aiNotes: product.aiNotes ?? null,
    aiConfidence: product.aiConfidence === null ? null : Number(product.aiConfidence)
  };
}

export function parseGenerationReviewSnapshot(value: unknown): GenerationReviewSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<GenerationReviewSnapshot>;

  return {
    metadata: snapshot.metadata ?? null,
    images: snapshot.images ?? null
  };
}
