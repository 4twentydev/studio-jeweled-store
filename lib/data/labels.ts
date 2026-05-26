import { hasDatabase } from "@/db";
import { listProducts, listProductsByIds } from "@/db/queries";
import type { ProductStatus } from "@/db/schema";
import { demoInventory } from "@/lib/demo-data";
import {
  type LabelQrTarget,
  generateQrCodeDataUrl,
  getInternalProductUrl,
  getPublicProductUrl
} from "@/lib/labels";

export type LabelListItem = {
  id: string;
  title: string;
  sku: string;
  category: string;
  priceCents: number;
  status: ProductStatus;
  isPublished: boolean;
  hasPublicUrl: boolean;
};

export type PrintableLabel = {
  id: string;
  title: string;
  sku: string;
  category: string;
  priceCents: number;
  qrCodeDataUrl: string;
  qrTargetUrl: string;
  qrTargetLabel: string;
};

function toPriceCents(price: string) {
  return Math.round(Number(price) * 100);
}

function sortByRequestedOrder<T extends { id: string }>(
  items: T[],
  orderedIds: string[]
) {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort(
    (left, right) =>
      (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0)
  );
}

export async function getLabelSelectionList() {
  if (!hasDatabase()) {
    return demoInventory.map((product) => ({
      id: product.id,
      title: product.title,
      sku: product.sku,
      category: product.category,
      priceCents: product.priceCents,
      status: product.status,
      isPublished: product.status === "published",
      hasPublicUrl: false
    }));
  }

  const products = await listProducts({ limit: 200 });

  return products.map((product) => ({
    id: product.id,
    title: product.title,
    sku: product.sku,
    category: product.category,
    priceCents: toPriceCents(product.price),
    status: product.status,
    isPublished: product.status === "published",
    hasPublicUrl: Boolean(getPublicProductUrl(product))
  }));
}

export async function getPrintableLabels(
  productIds: string[],
  qrTarget: LabelQrTarget
) {
  if (!hasDatabase()) {
    return Promise.all(
      sortByRequestedOrder(
        demoInventory.filter((product) => productIds.includes(product.id)),
        productIds
      ).map(async (product) => {
        const qrTargetUrl = getInternalProductUrl(product.id);

        return {
          id: product.id,
          title: product.title,
          sku: product.sku,
          category: product.category,
          priceCents: product.priceCents,
          qrCodeDataUrl: await generateQrCodeDataUrl(qrTargetUrl),
          qrTargetUrl,
          qrTargetLabel: "Studio inventory detail"
        };
      })
    );
  }

  const products = sortByRequestedOrder(
    await listProductsByIds(productIds),
    productIds
  );

  return Promise.all(
    products.map(async (product) => {
      const publicUrl = getPublicProductUrl(product);
      const qrTargetUrl =
        qrTarget === "public" && publicUrl
          ? publicUrl
          : getInternalProductUrl(product.id);
      const qrTargetLabel =
        qrTarget === "public" && publicUrl
          ? "Public product page"
          : "Studio inventory detail";

      return {
        id: product.id,
        title: product.title,
        sku: product.sku,
        category: product.category,
        priceCents: toPriceCents(product.price),
        qrCodeDataUrl: await generateQrCodeDataUrl(qrTargetUrl),
        qrTargetUrl,
        qrTargetLabel
      };
    })
  );
}
