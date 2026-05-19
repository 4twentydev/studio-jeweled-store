import { env } from "@/lib/env";
import type { Product } from "@/db/schema";

export async function publishToStorefront(
  product: Product & {
    imageUrl?: string | null;
  }
) {
  if (!env.STOREFRONT_PUBLISH_URL) {
    return;
  }

  const response = await fetch(env.STOREFRONT_PUBLISH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.STOREFRONT_PUBLISH_TOKEN
        ? {
            Authorization: `Bearer ${env.STOREFRONT_PUBLISH_TOKEN}`
          }
        : {})
    },
    body: JSON.stringify({
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      title: product.title,
      description: product.description,
      price: Number(product.price),
      quantity: product.quantity,
      tags: product.tags,
      imageUrl: product.imageUrl ?? null
    })
  });

  if (!response.ok) {
    throw new Error(`Storefront publish failed with status ${response.status}.`);
  }
}
