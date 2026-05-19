export type ProductImagePromptInput = {
  itemNameIdea?: string;
  materials?: string;
  specialDetails?: string;
  notes?: string;
};

type ImageVariant = "primary" | "clean-background";

export function buildProductImagePrompt(input: ProductImagePromptInput, variant: ImageVariant) {
  const variantInstruction =
    variant === "clean-background"
      ? "Use a transparent or extremely clean isolated background suitable for flexible merchandising if the model supports it."
      : "Use a clean square ecommerce composition with a refined studio background suitable for product cards.";

  return [
    "Edit this product photo into JWLD.store's ecommerce style.",
    "Preserve the exact product design, silhouette, proportions, color, materials, rhinestones, handmade decorations, and visible details.",
    "Do not invent embellishments, remove decorations, or alter the product itself.",
    "Improve lighting, crop, background, shadow, sharpness, and presentation only.",
    "Keep the full item clearly visible and centered in a square frame.",
    variantInstruction,
    `Item name idea: ${input.itemNameIdea?.trim() || "None provided"}`,
    `Materials: ${input.materials?.trim() || "None provided"}`,
    `Special details: ${input.specialDetails?.trim() || "None provided"}`,
    `Additional notes: ${input.notes?.trim() || "None provided"}`
  ].join("\n");
}
