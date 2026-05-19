import { formatPrice } from "@/db/products";

export function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(valueInCents / 100);
}

export { formatPrice };
