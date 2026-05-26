import type { Product } from "@/db/schema";
import { env } from "@/lib/env";
import QRCode from "qrcode";

const CATEGORY_CODE_OVERRIDES: Record<string, string> = {
  lighters: "LTR",
  "lighter cases": "CASE",
  containers: "CNTR",
  "lip balm holders": "LBH",
  accessories: "ACC",
  "custom pieces": "CSTM",
  "one-of-one": "OOO"
};

function normalizeCategoryKey(category: string) {
  return category.trim().toLowerCase();
}

function sanitizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function compactAlphaNumeric(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getCategoryCode(category: string) {
  const override = CATEGORY_CODE_OVERRIDES[normalizeCategoryKey(category)];

  if (override) {
    return override;
  }

  const parts = category.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "GEN";
  }

  const fromWords = parts
    .map((part) => compactAlphaNumeric(part).slice(0, 2))
    .join("");
  return (fromWords || compactAlphaNumeric(category)).slice(0, 5) || "GEN";
}

export function formatSkuDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildSku(category: string, date: Date, sequence: number) {
  return `JWLD-${getCategoryCode(category)}-${formatSkuDate(date)}-${`${sequence}`.padStart(4, "0")}`;
}

export function getInternalProductUrl(productId: string) {
  return `${sanitizeBaseUrl(env.APP_URL)}/inventory/${productId}`;
}

export function getPublicProductUrl(product: Pick<Product, "slug" | "status">) {
  if (product.status !== "published" || !env.JWLD_STOREFRONT_URL) {
    return null;
  }

  return `${sanitizeBaseUrl(env.JWLD_STOREFRONT_URL)}/products/${product.slug}`;
}

export async function generateQrCodeDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220
  });
}

export type LabelQrTarget = "internal" | "public";
