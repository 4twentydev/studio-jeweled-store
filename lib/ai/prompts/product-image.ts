import type { StylePreset } from "@/db/schema";

export type ProductImagePromptInput = {
  itemNameIdea?: string;
  materials?: string;
  specialDetails?: string;
  notes?: string;
  creativity?: "low" | "medium" | "high";
  humanInstruction?: string | null;
};

type ImageVariant = "primary" | "clean-background";

export function buildProductImagePrompt(
  input: ProductImagePromptInput,
  variant: ImageVariant,
  preset: Pick<
    StylePreset,
    "name" | "description" | "backgroundPrompt" | "lightingPrompt" | "shadowPrompt" | "cropRatio" | "outputSize"
  >
) {
  const variantInstruction =
    variant === "clean-background"
      ? "Use a transparent or exceptionally clean isolated background if the model supports it."
      : "Use the selected studio preset for final presentation.";

  return [
    `Edit this product photo using the JWLD Studio preset "${preset.name}".`,
    "Preserve the exact product design, silhouette, proportions, color, materials, rhinestones, handmade decorations, and visible details.",
    "Do not alter the actual item in any way.",
    "Do not invent embellishments, remove decorations, reshape the piece, replace materials, or change construction details.",
    "Style changes may affect background, crop, lighting, shadow, and presentation only.",
    "Image prompt must preserve the product.",
    `Preset description: ${preset.description || "None provided"}`,
    `Background direction: ${preset.backgroundPrompt}`,
    `Lighting direction: ${preset.lightingPrompt}`,
    `Shadow direction: ${preset.shadowPrompt}`,
    `Crop ratio: ${preset.cropRatio}`,
    `Target output size: ${preset.outputSize}`,
    variantInstruction,
    `Item name idea: ${input.itemNameIdea?.trim() || "None provided"}`,
    `Materials: ${input.materials?.trim() || "None provided"}`,
    `Special details: ${input.specialDetails?.trim() || "None provided"}`,
    `Additional notes: ${input.notes?.trim() || "None provided"}`,
    `Creativity level: ${input.creativity ?? "medium"}`,
    `Human instruction: ${input.humanInstruction?.trim() || "None provided"}`
  ].join("\n");
}
