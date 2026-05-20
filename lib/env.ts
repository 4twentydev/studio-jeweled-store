import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  JWLD_PUBLISH_MODE: z.enum(["shared_db", "api_push", "export"]).default("export"),
  JWLD_STOREFRONT_URL: z.string().url().optional(),
  JWLD_STORE_API_URL: z.string().url().optional(),
  JWLD_STORE_API_KEY: z.string().optional()
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  JWLD_PUBLISH_MODE: process.env.JWLD_PUBLISH_MODE ?? "export",
  JWLD_STOREFRONT_URL: process.env.JWLD_STOREFRONT_URL,
  JWLD_STORE_API_URL: process.env.JWLD_STORE_API_URL,
  JWLD_STORE_API_KEY: process.env.JWLD_STORE_API_KEY
});

const featureFlags = {
  database: Boolean(env.DATABASE_URL),
  openai: Boolean(env.OPENAI_API_KEY),
  blob: Boolean(env.BLOB_READ_WRITE_TOKEN),
  storefront:
    env.JWLD_PUBLISH_MODE === "export" ||
    env.JWLD_PUBLISH_MODE === "shared_db" ||
    Boolean(env.JWLD_STORE_API_URL)
} as const;

export function getFeatureStatus() {
  return featureFlags;
}

export function assertFeatureEnabled(feature: keyof typeof featureFlags) {
  if (!featureFlags[feature]) {
    throw new Error(`Missing environment configuration for ${feature}.`);
  }
}
