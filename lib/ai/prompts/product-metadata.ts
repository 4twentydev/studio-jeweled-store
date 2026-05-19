import { jwldProductCategories } from "@/lib/ai/schemas/product-metadata";

export type ProductMetadataPromptInput = {
  itemNameIdea?: string;
  notes?: string;
  materials?: string;
  quantity?: number;
  estimatedTimeSpent?: string;
  specialDetails?: string;
};

export function buildProductMetadataPrompt(input: ProductMetadataPromptInput) {
  const pricingRules = [
    "Handmade decorated lighters: usually $12-$35.",
    "Lighter cases: usually $15-$45.",
    "Small containers: usually $15-$50.",
    "More complex rhinestone or custom pieces: usually $35-$120+.",
    "One-of-One pieces should price higher.",
    "If uncertain, choose a reasonable price and explain the uncertainty in notesForHuman."
  ].join(" ");

  const context = [
    `Item name idea: ${input.itemNameIdea?.trim() || "None provided"}`,
    `Materials: ${input.materials?.trim() || "None provided"}`,
    `Quantity observed or requested: ${input.quantity ?? 1}`,
    `Estimated time spent: ${input.estimatedTimeSpent?.trim() || "None provided"}`,
    `Special details: ${input.specialDetails?.trim() || "None provided"}`,
    `General notes: ${input.notes?.trim() || "None provided"}`
  ].join("\n");

  return [
    "You generate ecommerce metadata for JWLD Studio, a handmade product studio.",
    "Use the product photo as the primary source of truth.",
    "Do not invent materials, colors, quantities, decorations, or features that are not visible or explicitly stated.",
    "If uncertain, make the most conservative reasonable call and explain the uncertainty in notesForHuman.",
    `Allowed categories: ${jwldProductCategories.join(" | ")}.`,
    pricingRules,
    "Write concise, commercially useful metadata for JWLD.store.",
    "Prefer short, search-friendly titles and natural descriptions.",
    context
  ].join("\n\n");
}
