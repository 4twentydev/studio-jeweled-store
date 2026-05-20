import { hasDatabase } from "@/db";
import { getInventoryData } from "@/lib/data/products";
import { buildApprovedProductsExport } from "@/lib/publishing/publisher";

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
  const approvedOnly = searchParams.get("approvedOnly") === "true";
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  if (approvedOnly) {
    if (!hasDatabase()) {
      const inventory = await getInventoryData();
      const approvedInventory = inventory
        .filter((item) => item.status === "approved")
        .filter((item) => !productIds.length || productIds.includes(item.id));

      const records = approvedInventory.map((item) => ({
        id: item.id,
        sku: item.sku,
        slug: item.slug,
        title: item.title,
        description: item.description,
        shortDescription: item.shortDescription,
        category: item.category,
        subcategory: item.subcategory,
        price: item.priceCents / 100,
        compareAtPrice: null,
        quantity: item.quantityOnHand,
        condition: "handmade",
        materials: [],
        colors: [],
        tags: item.tags,
        primaryImageUrl: item.styledImageUrl,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString()
      }));

      const content =
        format === "csv"
          ? [
              [
                "id",
                "sku",
                "slug",
                "title",
                "description",
                "shortDescription",
                "category",
                "subcategory",
                "price",
                "compareAtPrice",
                "quantity",
                "condition",
                "materials",
                "colors",
                "tags",
                "primaryImageUrl",
                "publishedAt",
                "updatedAt"
              ],
              ...records.map((record) => [
                record.id,
                record.sku,
                record.slug,
                record.title,
                record.description,
                record.shortDescription ?? "",
                record.category,
                record.subcategory ?? "",
                record.price.toFixed(2),
                "",
                record.quantity,
                record.condition,
                "",
                "",
                record.tags.join("|"),
                record.primaryImageUrl,
                record.publishedAt ?? "",
                record.updatedAt
              ])
            ]
              .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
              .join("\n")
          : JSON.stringify(records, null, 2);

      return new Response(content, {
        headers: {
          "Content-Type":
            format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="jwld-approved-products.${format}"`
        }
      });
    }

    const exportData = await buildApprovedProductsExport({
      productIds: productIds.length ? productIds : undefined,
      format
    });

    return new Response(exportData.content, {
      headers: {
        "Content-Type":
          format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jwld-approved-products.${format}"`
      }
    });
  }

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
