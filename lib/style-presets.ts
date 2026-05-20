export const DEFAULT_STYLE_PRESETS = [
  {
    name: "JWLD Clean Black",
    description:
      "Dark luxury ecommerce background with soft reflection, crisp product focus, and premium boutique polish.",
    backgroundPrompt:
      "Deep charcoal luxury ecommerce backdrop with subtle gradient depth, no clutter, and a premium boutique feel.",
    lightingPrompt:
      "Soft diffused studio lighting with crisp edge definition, accurate metal tones, and controlled specular highlights.",
    shadowPrompt:
      "Low soft reflection beneath the product with a refined shadow that grounds the item without distracting from it.",
    cropRatio: "1:1",
    outputSize: "1024x1024",
    exampleImageUrls: [],
    isDefault: true
  },
  {
    name: "JWLD Clean White",
    description:
      "Bright neutral catalog background with soft shadow and a clean product-card presentation for standard storefront listings.",
    backgroundPrompt:
      "Bright neutral white product-card background with gentle tonal separation and clean catalog clarity.",
    lightingPrompt:
      "Even bright studio lighting with soft contrast, accurate product color, and balanced reflections.",
    shadowPrompt:
      "Soft natural shadow under the item to keep it grounded while preserving a clean minimal catalog look.",
    cropRatio: "1:1",
    outputSize: "1024x1024",
    exampleImageUrls: [],
    isDefault: false
  },
  {
    name: "Rhinestone Close-Up",
    description:
      "Tighter crop that emphasizes sparkle, texture, and heavily decorated surfaces without changing the piece itself.",
    backgroundPrompt:
      "Minimal luxury backdrop with shallow visual depth so rhinestone detail remains the center of attention.",
    lightingPrompt:
      "Controlled close-range lighting that brings out sparkle, facets, and surface texture without blowing out highlights.",
    shadowPrompt:
      "Very soft compact shadowing with subtle highlight rolloff to emphasize detail over environmental mood.",
    cropRatio: "4:5",
    outputSize: "1024x1536",
    exampleImageUrls: [],
    isDefault: false
  },
  {
    name: "Lifestyle Countertop",
    description:
      "Realistic boutique countertop presentation for social-ready imagery that still keeps the product unmistakably accurate.",
    backgroundPrompt:
      "Realistic boutique countertop setting with restrained styling, believable depth, and no overly staged props.",
    lightingPrompt:
      "Natural boutique daylight mixed with soft fill, preserving realism while keeping the product clear and flattering.",
    shadowPrompt:
      "Natural surface shadowing consistent with countertop photography, subtle and believable rather than dramatic.",
    cropRatio: "4:5",
    outputSize: "1024x1536",
    exampleImageUrls: [],
    isDefault: false
  }
] as const;

export type DefaultStylePreset = (typeof DEFAULT_STYLE_PRESETS)[number];

const SUPPORTED_OUTPUT_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);

export function normalizeOutputSize(size: string | null | undefined) {
  const value = size?.trim() ?? "";

  if (SUPPORTED_OUTPUT_SIZES.has(value)) {
    return value;
  }

  if (value === "1536x1536") {
    return "1024x1024";
  }

  if (value === "1536x1920") {
    return "1024x1536";
  }

  if (value === "1920x1536" || value === "1280x1024") {
    return "1536x1024";
  }

  if (value === "1024x1280") {
    return "1024x1536";
  }

  return "1024x1024";
}
