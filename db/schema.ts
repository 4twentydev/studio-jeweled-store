import { pgEnum, pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "ready_for_review",
  "approved",
  "published",
  "archived"
]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: text("sku").notNull().unique(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  materials: text("materials").array().notNull().default([]),
  collection: text("collection").notNull(),
  category: text("category").notNull(),
  finish: text("finish").notNull(),
  colorTone: text("color_tone").notNull(),
  dimensions: text("dimensions").notNull(),
  priceCents: integer("price_cents").notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  reorderThreshold: integer("reorder_threshold").notNull().default(2),
  status: productStatusEnum("status").notNull().default("draft"),
  tags: text("tags").array().notNull().default([]),
  aiModel: text("ai_model"),
  aiSummary: jsonb("ai_summary").$type<{
    confidence?: number;
    merchandisingNotes?: string;
  }>(),
  originalImageUrl: text("original_image_url").notNull(),
  styledImageUrl: text("styled_image_url").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const studioSettings = pgTable("studio_settings", {
  id: text("id").primaryKey(),
  brandVoice: text("brand_voice").notNull(),
  defaultMarkupPercent: integer("default_markup_percent").notNull(),
  defaultCollection: text("default_collection").notNull(),
  publishMode: text("publish_mode").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type StudioSettings = typeof studioSettings.$inferSelect;
