import { jwldProductCategories } from "@/lib/ai/schemas/product-metadata";

export type ProductMetadataPromptInput = {
  itemNameIdea?: string;
  notes?: string;
  materials?: string;
  quantity?: number;
  estimatedTimeSpent?: string;
  specialDetails?: string;
  creativity?: "low" | "medium" | "high";
  descriptionTone?:
    | "clean luxury"
    | "playful boutique"
    | "bold and edgy"
    | "simple catalog";
  priceStrategy?: "budget" | "standard" | "premium" | "one-of-one";
  humanInstruction?: string | null;
  scope?: "all" | "image" | "title_description" | "price" | "category_tags";
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
    `General notes: ${input.notes?.trim() || "None provided"}`,
    `Creativity level: ${input.creativity ?? "medium"}`,
    `Description tone: ${input.descriptionTone ?? "clean luxury"}`,
    `Price strategy: ${input.priceStrategy ?? "standard"}`,
    `Requested regeneration scope: ${input.scope ?? "all"}`,
    `Human instruction: ${input.humanInstruction?.trim() || "None provided"}`
  ].join("\n");

  const scopeInstructions = [
    input.scope === "title_description"
      ? "Prioritize improving the title, short description, and description. Keep pricing and categorization conservative unless clearly wrong."
      : null,
    input.scope === "price"
      ? "Prioritize pricing. Keep title, description, category, and tags close to the current product unless the photo strongly contradicts them."
      : null,
    input.scope === "category_tags"
      ? "Prioritize category, subcategory, and tags. Keep pricing and long-form copy close to the current product unless the photo strongly contradicts them."
      : null
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "You generate ecommerce metadata for JWLD Studio, a handmade product studio.",
    "Use the product photo as the primary source of truth.",
    "Do not invent materials, colors, quantities, decorations, or features that are not visible or explicitly stated.",
    "If uncertain, make the most conservative reasonable call and explain the uncertainty in notesForHuman.",
    `Allowed categories: ${jwldProductCategories.join(" | ")}.`,
    pricingRules,
    "Write concise, commercially useful metadata for JWLD.store.",
    "Prefer short, search-friendly titles and natural descriptions.",
    "Use the requested tone for title and description unless it conflicts with visible product facts.",
    scopeInstructions,
    context
  ].join("\n\n");
}
