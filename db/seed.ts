import { getDb } from "@/db";
import { products, studioSettings } from "@/db/schema";

const db = getDb();

await db.insert(studioSettings).values({
  id: "default",
  brandVoice:
    "Elegant, intimate, and quietly luxurious. Focus on handmade craftsmanship, materials, and how the piece styles for day-to-night wear.",
  defaultMarkupPercent: 62,
  defaultCollection: "Core Collection",
  publishMode: "Manual review required"
}).onConflictDoNothing();

await db.insert(products).values([
  {
    sku: "LUNAIR-A12F",
    slug: "lunair-drop-earrings",
    title: "Lunair Drop Earrings",
    description: "Hand-forged silver drops with moonstone shimmer and a clean studio finish.",
    materials: ["Sterling silver", "Moonstone"],
    collection: "Moonlit",
    category: "Earrings",
    finish: "Polished",
    colorTone: "Cool silver",
    dimensions: "2 in drop length",
    priceCents: 9200,
    quantityOnHand: 3,
    reorderThreshold: 2,
    status: "ready_for_review",
    tags: ["moonstone", "silver", "bridal"],
    aiModel: "gpt-4.1-mini",
    aiSummary: { confidence: 0.92, merchandisingNotes: "Strong bridal and occasion styling fit." },
    originalImageUrl: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=1200&q=80",
    styledImageUrl: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=1200&q=80"
  },
  {
    sku: "SOLACE-1K3P",
    slug: "solace-chain-bracelet",
    title: "Solace Chain Bracelet",
    description: "Soft gold chain bracelet with sculptural clasp and a polished luxury profile.",
    materials: ["14k gold fill"],
    collection: "Solace",
    category: "Bracelets",
    finish: "High polish",
    colorTone: "Warm gold",
    dimensions: "7 in length",
    priceCents: 7600,
    quantityOnHand: 7,
    reorderThreshold: 2,
    status: "published",
    tags: ["gold", "bracelet", "everyday"],
    aiModel: "gpt-4.1-mini",
    aiSummary: { confidence: 0.89, merchandisingNotes: "Strong layering product for storefront upsells." },
    originalImageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80",
    styledImageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80"
  }
]).onConflictDoNothing();

console.log("Seed complete.");
