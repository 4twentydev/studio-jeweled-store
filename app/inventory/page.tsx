import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { getInventoryData } from "@/lib/data/products";

export default async function InventoryPage() {
  const items = await getInventoryData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl">Inventory</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Current inventory levels, publish state, and metadata completeness.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="relative aspect-[4/5]">
              <Image
                src={item.styledImageUrl}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-[var(--font-display)] text-2xl">{item.title}</CardTitle>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{item.sku}</p>
                </div>
                <Badge variant={item.status === "published" ? "default" : "secondary"}>{item.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-muted-foreground">
                <div className="rounded-2xl border bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.2em]">On hand</p>
                  <p className="mt-2 text-lg text-foreground">{item.quantityOnHand}</p>
                </div>
                <div className="rounded-2xl border bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.2em]">Price</p>
                  <p className="mt-2 text-lg text-foreground">{formatCurrency(item.priceCents)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
