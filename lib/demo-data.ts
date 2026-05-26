export const demoInventory = [
  {
    id: "7d2b9434-e395-4c57-9f75-5bbeb6ca11e1",
    sku: "LUNAIR-A12F",
    slug: "lunair-drop-earrings",
    title: "Lunair Drop Earrings",
    description:
      "Hand-forged silver drops with moonstone shimmer and a clean studio finish.",
    tags: ["moonstone", "silver", "bridal"],
    category: "Accessories",
    collection: "Moonlit",
    priceCents: 9200,
    quantityOnHand: 3,
    status: "review" as const,
    styledImageUrl:
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "f2e1e694-24cc-44e5-b6f0-cbdd2d6e2990",
    sku: "SOLACE-1K3P",
    slug: "solace-chain-bracelet",
    title: "Solace Chain Bracelet",
    description:
      "Soft gold chain bracelet with sculptural clasp and a polished luxury profile.",
    tags: ["gold", "bracelet", "everyday"],
    category: "Accessories",
    collection: "Solace",
    priceCents: 7600,
    quantityOnHand: 7,
    status: "published" as const,
    styledImageUrl:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "7b74156d-7f8d-4f5d-b0d1-1e6cf7ab2d54",
    sku: "ARCANA-87LP",
    slug: "arcana-statement-ring",
    title: "Arcana Statement Ring",
    description:
      "A textured statement ring with rich patina and refined studio color control.",
    tags: ["ring", "statement", "silver"],
    category: "One-of-One",
    collection: "Arcana",
    priceCents: 10800,
    quantityOnHand: 2,
    status: "approved" as const,
    styledImageUrl:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80"
  }
];

export const demoSettings = {
  brandVoice: {
    productDescriptionPrompt:
      "Write product descriptions for a boutique studio catalog. Emphasize craft, material detail, finish, and collector appeal while keeping the tone concise and premium.",
    defaultTone: "Elevated and tactile",
    wordsToPrefer: ["handmade", "collector", "polished", "boutique"],
    wordsToAvoid: ["cheap", "perfect", "generic", "mass-market"],
    exampleProductDescriptions: [
      "Crystal-detailed lighter case with a polished handmade finish, balanced sparkle, and a boutique display presence.",
      "Compact accessory with tactile texture, clean structure, and an elevated studio presentation for everyday carry."
    ]
  },
  pricingRules: {
    categoryBasePrices: [
      { category: "Lighters", value: 48 },
      { category: "Accessories", value: 32 },
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
    defaultStylePresetId: "JWLD Clean Black",
    outputSize: "1024x1024",
    backgroundPreference: "Luxury studio backdrop with restrained contrast",
    cropPreference: "Centered catalog crop"
  },
  publishing: {
    publishMode: "export" as const,
    storeApiUrl: null,
    exportFormat: "csv" as const,
    exportFilenamePrefix: "jwld-store",
    exportIncludeImages: true
  },
  categories: {
    categories: ["Lighters", "Accessories", "One-of-One"],
    subcategories: [
      { category: "Accessories", subcategory: "Bracelets" },
      { category: "Accessories", subcategory: "Rings" }
    ]
  },
  users: [
    { name: "Studio Admin", role: "admin" as const },
    { name: "Primary Creator", role: "creator" as const },
    { name: "Review Queue", role: "reviewer" as const }
  ]
};
