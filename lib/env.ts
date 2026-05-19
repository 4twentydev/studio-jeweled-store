import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  STOREFRONT_PUBLISH_URL: z.string().url().optional(),
  STOREFRONT_PUBLISH_TOKEN: z.string().optional()
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  STOREFRONT_PUBLISH_URL: process.env.STOREFRONT_PUBLISH_URL,
  STOREFRONT_PUBLISH_TOKEN: process.env.STOREFRONT_PUBLISH_TOKEN
});

const featureFlags = {
  database: Boolean(env.DATABASE_URL),
  openai: Boolean(env.OPENAI_API_KEY),
  blob: Boolean(env.BLOB_READ_WRITE_TOKEN),
  storefront: Boolean(env.STOREFRONT_PUBLISH_URL)
} as const;

export function getFeatureStatus() {
  return featureFlags;
}

export function assertFeatureEnabled(feature: keyof typeof featureFlags) {
  if (!featureFlags[feature]) {
    throw new Error(`Missing environment configuration for ${feature}.`);
  }
}
