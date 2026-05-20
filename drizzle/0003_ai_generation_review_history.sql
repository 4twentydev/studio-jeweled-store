ALTER TABLE "ai_generations"
  ADD COLUMN "options" jsonb,
  ADD COLUMN "human_instruction" text,
  ADD COLUMN "is_selected_final" boolean DEFAULT false NOT NULL,
  ADD COLUMN "selected_at" timestamp with time zone;
