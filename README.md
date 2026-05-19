# JWLD Studio

Production-ready Next.js App Router application for JWLD.store inventory operations. Kylie can capture a product photo on mobile, run an AI-assisted intake workflow, review metadata, save inventory, and optionally publish to the storefront.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style component structure
- Framer Motion
- Neon Postgres
- Drizzle ORM
- Zod
- Vercel Blob
- OpenAI Node SDK
- Bun
- Biome

## What’s included

- Dark-first mobile UI with dashboard, capture, inventory, review, and settings routes
- Server-component-first architecture
- Server Actions for capture ingestion, approvals, publishing, and settings
- Drizzle schema for products and studio settings
- OpenAI integration for metadata generation and image restyling
- Vercel Blob upload helpers for original and styled images
- Optional storefront publish webhook
- Seed script and environment example
- Fallback demo reads when `DATABASE_URL` is not configured, so the UI still loads during setup

## Project structure

```text
app/
  actions/
  capture/
  inventory/
  review/
  settings/
components/
  dashboard/
  forms/
  layout/
  motion/
  ui/
db/
  index.ts
  schema.ts
  seed.ts
lib/
  ai.ts
  blob.ts
  data/
  demo-data.ts
  env.ts
  storefront.ts
```

## Local setup

1. Install dependencies:

```bash
bun install
```

2. Copy envs:

```bash
cp .env.example .env.local
```

3. Fill in:

- `DATABASE_URL`: Neon connection string
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `STOREFRONT_PUBLISH_URL` and `STOREFRONT_PUBLISH_TOKEN` if you want publish webhooks

4. Generate and push the database schema:

```bash
bun run db:generate
bun run db:push
```

5. Seed sample data:

```bash
bun run db:seed
```

6. Start the app:

```bash
bun run dev
```

The app runs at `http://localhost:3000`.

## Neon setup

1. Create a Neon Postgres project.
2. Copy the pooled or direct connection string into `DATABASE_URL`.
3. Run `bun run db:push` to create tables.

## Vercel Blob setup

1. In Vercel, create a Blob store attached to the project.
2. Pull env vars locally with `vercel env pull` or paste `BLOB_READ_WRITE_TOKEN` into `.env.local`.
3. The capture flow uploads the original photo and the AI-styled asset through server actions.

## OpenAI setup

The intake flow uses:

- `responses.create()` with image input for structured metadata generation
- `images.edit()` for storefront-style image normalization

If `OPENAI_API_KEY` is missing, capture mutations are blocked intentionally.

## Storefront publishing

`publishProductAction` posts the approved product payload to `STOREFRONT_PUBLISH_URL` if configured. This is intentionally decoupled so JWLD Studio can publish to Shopify, a custom API, or another downstream service without changing the review UI.

Example payload:

```json
{
  "id": "uuid",
  "sku": "LUNAIR-A12F",
  "slug": "lunair-drop-earrings",
  "title": "Lunair Drop Earrings",
  "description": "Hand-forged silver drops with moonstone shimmer and a clean studio finish.",
  "priceCents": 9200,
  "quantityOnHand": 3,
  "tags": ["moonstone", "silver", "bridal"],
  "imageUrl": "https://..."
}
```

## Deployment on Vercel

1. Create a Vercel project from this repo.
2. Add environment variables:

- `APP_URL`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `STOREFRONT_PUBLISH_URL`
- `STOREFRONT_PUBLISH_TOKEN`

3. Deploy.
4. Run database provisioning:

```bash
bun run db:push
bun run db:seed
```

You can run those through a CI job, local terminal, or Vercel build step depending on your release process.

## Notes

- The app uses App Router only; there is no Pages Router code.
- Reads fall back to demo content without a database, but writes require configured services.
- Image styling falls back to the original upload if the image-edit step fails, so intake can still continue.
