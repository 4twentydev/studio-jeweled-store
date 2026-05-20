ALTER TABLE "style_presets"
  ADD COLUMN IF NOT EXISTS "shadow_prompt" text NOT NULL DEFAULT 'Soft grounding shadow only.';

ALTER TABLE "ai_generations"
  ADD COLUMN IF NOT EXISTS "style_preset_id" uuid;

DO $$
BEGIN
  ALTER TABLE "ai_generations"
    ADD CONSTRAINT "ai_generations_style_preset_id_style_presets_id_fk"
    FOREIGN KEY ("style_preset_id") REFERENCES "public"."style_presets"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
