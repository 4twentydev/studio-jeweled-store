CREATE TYPE "publish_mode" AS ENUM ('shared_db', 'api_push', 'export');

CREATE TABLE "publish_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "mode" "publish_mode" NOT NULL,
  "success" boolean NOT NULL,
  "message" text NOT NULL,
  "target" text,
  "payload" jsonb,
  "response" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "publish_results"
  ADD CONSTRAINT "publish_results_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX "publish_results_product_id_idx"
  ON "publish_results" USING btree ("product_id", "created_at");
