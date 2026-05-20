import { getInventoryData } from "@/lib/data/products";

function escapeCsvValue(value: string | number) {
  const stringValue = String(value);

  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productIds = searchParams.getAll("productIds");
  const inventory = await getInventoryData();
  const selectedInventory = productIds.length
    ? inventory.filter((item) => productIds.includes(item.id))
    : inventory;

  const header = [
    "SKU",
    "Title",
    "Category",
    "Price",
    "Quantity",
    "Status",
    "Published",
    "Last Updated"
  ];

  const rows = selectedInventory.map((item) => [
    item.sku,
    item.title,
    item.category,
    (item.priceCents / 100).toFixed(2),
    item.quantityOnHand,
    item.status,
    item.isPublished ? "yes" : "no",
    item.updatedAt.toISOString()
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jwld-inventory.csv"'
    }
  });
}
