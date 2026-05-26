const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  console.log("No database URL configured; skipping database migrations.");
  process.exit(0);
}

process.env.DATABASE_URL = databaseUrl;

const migration = Bun.spawn(["bun", "run", "db:migrate"], {
  stdout: "inherit",
  stderr: "inherit",
  env: process.env
});

process.exit(await migration.exited);
