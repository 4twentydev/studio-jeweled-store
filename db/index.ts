import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function createDbClient() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = neon(env.DATABASE_URL);
  return drizzle(client, { schema });
}

type DatabaseClient = ReturnType<typeof createDbClient>;

declare global {
  // eslint-disable-next-line no-var
  var __jwldDb__: DatabaseClient | undefined;
}

export function hasDatabase() {
  return Boolean(env.DATABASE_URL);
}

export function getDb() {
  if (!globalThis.__jwldDb__) {
    globalThis.__jwldDb__ = createDbClient();
  }

  return globalThis.__jwldDb__;
}

export const db = hasDatabase() ? getDb() : null;
