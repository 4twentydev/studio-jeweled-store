import { env } from "@/lib/env";
import type { Product } from "@/db/schema";

export async function publishToStorefront(product: Product) {
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
      priceCents: product.priceCents,
      quantityOnHand: product.quantityOnHand,
      tags: product.tags,
      imageUrl: product.styledImageUrl
    })
  });

  if (!response.ok) {
    throw new Error(`Storefront publish failed with status ${response.status}.`);
  }
}
