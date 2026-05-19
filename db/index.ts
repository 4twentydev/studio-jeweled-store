import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

export function hasDatabase() {
  return Boolean(env.DATABASE_URL);
}

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = neon(env.DATABASE_URL);
  return drizzle(client, { schema });
}
