import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const productStatuses = [
  "draft",
  "review",
  "approved",
  "published",
  "archived",
  "sold"
] as const;

export const productConditions = [
  "new",
  "handmade",
  "custom",
  "one_of_one"
] as const;
export const imageKinds = [
  "original",
  "processed",
  "lifestyle",
  "detail",
  "thumbnail"
] as const;
export const aiGenerationStatuses = ["pending", "success", "failed"] as const;
export const publishModes = ["shared_db", "api_push", "export"] as const;

export const productStatusEnum = pgEnum("product_status", productStatuses);
export const productConditionEnum = pgEnum(
  "product_condition",
  productConditions
);
export const imageKindEnum = pgEnum("image_kind", imageKinds);
export const aiGenerationStatusEnum = pgEnum(
  "ai_generation_status",
  aiGenerationStatuses
);
export const publishModeEnum = pgEnum("publish_mode", publishModes);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    shortDescription: text("short_description"),
    category: text("category").notNull(),
    subcategory: text("subcategory"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
    costEstimate: numeric("cost_estimate", { precision: 10, scale: 2 }),
    quantity: integer("quantity").notNull().default(0),
    status: productStatusEnum("status").notNull().default("draft"),
    condition: productConditionEnum("condition").notNull().default("handmade"),
    materials: text("materials").array().notNull().default([]),
    colors: text("colors").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    aiConfidence: numeric("ai_confidence", { precision: 4, scale: 3 }),
    aiNotes: text("ai_notes"),
    createdBy: text("created_by"),
    approvedBy: text("approved_by"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(table.sku),
    uniqueIndex("products_slug_unique").on(table.slug),
    index("products_status_idx").on(table.status),
    index("products_category_idx").on(table.category),
    index("products_created_at_idx").on(table.createdAt)
  ]
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    originalUrl: text("original_url").notNull(),
    processedUrl: text("processed_url"),
    thumbnailUrl: text("thumbnail_url"),
    altText: text("alt_text"),
    isPrimary: boolean("is_primary").notNull().default(false),
    imageKind: imageKindEnum("image_kind").notNull().default("original"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("product_images_product_id_idx").on(table.productId),
    index("product_images_kind_idx").on(table.imageKind)
  ]
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null"
    }),
    stylePresetId: uuid("style_preset_id").references(() => stylePresets.id, {
      onDelete: "set null"
    }),
    inputImageUrl: text("input_image_url").notNull(),
    outputImageUrl: text("output_image_url"),
    model: text("model").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<unknown>(),
    humanInstruction: text("human_instruction"),
    rawResponse: jsonb("raw_response").$type<unknown>(),
    parsedResponse: jsonb("parsed_response").$type<unknown>(),
    status: aiGenerationStatusEnum("status").notNull().default("pending"),
    isSelectedFinal: boolean("is_selected_final").notNull().default(false),
    selectedAt: timestamp("selected_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [index("ai_generations_product_id_idx").on(table.productId)]
);

export const stylePresets = pgTable(
  "style_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    backgroundPrompt: text("background_prompt").notNull(),
    lightingPrompt: text("lighting_prompt").notNull(),
    shadowPrompt: text("shadow_prompt").notNull(),
    cropRatio: text("crop_ratio").notNull(),
    outputSize: text("output_size").notNull(),
    exampleImageUrls: text("example_image_urls").array().notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("style_presets_name_unique").on(table.name),
    index("style_presets_default_idx").on(table.isDefault)
  ]
);

export const appSettings = pgTable(
  "app_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [uniqueIndex("app_settings_key_unique").on(table.key)]
);

export const publishResults = pgTable(
  "publish_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mode: publishModeEnum("mode").notNull(),
    success: boolean("success").notNull(),
    message: text("message").notNull(),
    target: text("target"),
    payload: jsonb("payload").$type<unknown>(),
    response: jsonb("response").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("publish_results_product_id_idx").on(table.productId, table.createdAt)
  ]
);

export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
  aiGenerations: many(aiGenerations),
  publishResults: many(publishResults)
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id]
  })
}));

export const aiGenerationsRelations = relations(aiGenerations, ({ one }) => ({
  product: one(products, {
    fields: [aiGenerations.productId],
    references: [products.id]
  }),
  stylePreset: one(stylePresets, {
    fields: [aiGenerations.stylePresetId],
    references: [stylePresets.id]
  })
}));

export const stylePresetsRelations = relations(stylePresets, ({ many }) => ({
  aiGenerations: many(aiGenerations)
}));

export const publishResultsRelations = relations(publishResults, ({ one }) => ({
  product: one(products, {
    fields: [publishResults.productId],
    references: [products.id]
  })
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
export type AiGeneration = typeof aiGenerations.$inferSelect;
export type NewAiGeneration = typeof aiGenerations.$inferInsert;
export type StylePreset = typeof stylePresets.$inferSelect;
export type NewStylePreset = typeof stylePresets.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
export type PublishResultRecord = typeof publishResults.$inferSelect;
export type NewPublishResultRecord = typeof publishResults.$inferInsert;
export type ProductStatus = (typeof productStatuses)[number];
export type ProductCondition = (typeof productConditions)[number];
export type ImageKind = (typeof imageKinds)[number];
export type AiGenerationStatus = (typeof aiGenerationStatuses)[number];
export type PublishMode = (typeof publishModes)[number];
