CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "public"."ai_generation_status" AS ENUM('pending', 'success', 'failed');
CREATE TYPE "public"."image_kind" AS ENUM('original', 'processed', 'lifestyle', 'detail', 'thumbnail');
CREATE TYPE "public"."product_condition" AS ENUM('new', 'handmade', 'custom', 'one_of_one');
CREATE TYPE "public"."product_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived', 'sold');

CREATE TABLE "app_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sku" text NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "description" text NOT NULL,
  "short_description" text,
  "category" text NOT NULL,
  "subcategory" text,
  "price" numeric(10, 2) NOT NULL,
  "compare_at_price" numeric(10, 2),
  "cost_estimate" numeric(10, 2),
  "quantity" integer DEFAULT 0 NOT NULL,
  "status" "product_status" DEFAULT 'draft' NOT NULL,
  "condition" "product_condition" DEFAULT 'handmade' NOT NULL,
  "materials" text[] DEFAULT '{}' NOT NULL,
  "colors" text[] DEFAULT '{}' NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "ai_confidence" numeric(4, 3),
  "ai_notes" text,
  "created_by" text,
  "approved_by" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "original_url" text NOT NULL,
  "processed_url" text,
  "thumbnail_url" text,
  "alt_text" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "image_kind" "image_kind" DEFAULT 'original' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "ai_generations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid,
  "style_preset_id" uuid,
  "input_image_url" text NOT NULL,
  "output_image_url" text,
  "model" text NOT NULL,
  "prompt" text NOT NULL,
  "raw_response" jsonb,
  "parsed_response" jsonb,
  "status" "ai_generation_status" DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "style_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "background_prompt" text NOT NULL,
  "lighting_prompt" text NOT NULL,
  "shadow_prompt" text NOT NULL,
  "crop_ratio" text NOT NULL,
  "output_size" text NOT NULL,
  "example_image_urls" text[] DEFAULT '{}' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "ai_generations"
  ADD CONSTRAINT "ai_generations_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "ai_generations"
  ADD CONSTRAINT "ai_generations_style_preset_id_style_presets_id_fk"
  FOREIGN KEY ("style_preset_id") REFERENCES "public"."style_presets"("id")
  ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "app_settings_key_unique" ON "app_settings" USING btree ("key");
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("sku");
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");
CREATE INDEX "product_images_kind_idx" ON "product_images" USING btree ("image_kind");
CREATE INDEX "ai_generations_product_id_idx" ON "ai_generations" USING btree ("product_id");
CREATE UNIQUE INDEX "style_presets_name_unique" ON "style_presets" USING btree ("name");
CREATE INDEX "style_presets_default_idx" ON "style_presets" USING btree ("is_default");
