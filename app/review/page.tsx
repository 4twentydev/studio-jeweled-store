import Image from "next/image";
import { approveProductAction, publishProductAction } from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { getReviewQueue } from "@/lib/data/products";

export default async function ReviewPage() {
  const queue = await getReviewQueue();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl">Review queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve AI-generated drafts before they hit inventory or the storefront.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {queue.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
              <div className="relative min-h-[320px]">
                <Image src={item.styledImageUrl} alt={item.title} fill className="object-cover" sizes="50vw" />
              </div>
              <div className="flex flex-col">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="font-[var(--font-display)] text-3xl">{item.title}</CardTitle>
                    <Badge variant="secondary">{item.statusLabel}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-black/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">SKU</p>
                      <p className="mt-2">{item.sku}</p>
                    </div>
                    <div className="rounded-2xl border bg-black/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Price</p>
                      <p className="mt-2">{formatCurrency(item.priceCents)}</p>
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
                <CardFooter className="mt-auto flex gap-3">
                  <form action={approveProductAction} className="flex-1">
                    <input type="hidden" name="productId" value={item.id} />
                    <Button type="submit" className="w-full">
                      Approve Draft
                    </Button>
                  </form>
                  <form action={publishProductAction} className="flex-1">
                    <input type="hidden" name="productId" value={item.id} />
                    <Button type="submit" variant="secondary" className="w-full">
                      Publish
                    </Button>
                  </form>
                </CardFooter>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
