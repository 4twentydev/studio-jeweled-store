import Link from "next/link";
import { PrintButton } from "@/components/labels/print-button";
import { LabelSheet } from "@/components/labels/label-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLabelSelectionList, getPrintableLabels } from "@/lib/data/labels";
import type { LabelQrTarget } from "@/lib/labels";

function parseSelectedIds(value: string | string[] | undefined) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(new Set(source.filter(Boolean)));
}

function parseQrTarget(value: string | string[] | undefined): LabelQrTarget {
  return value === "public" ? "public" : "internal";
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function buildLabelsHref(qrTarget: LabelQrTarget, productIds: string[]) {
  const params = new URLSearchParams();
  params.set("qrTarget", qrTarget);

  for (const productId of productIds) {
    params.append("productIds", productId);
  }

  return `/app/labels?${params.toString()}`;
}

export default async function LabelsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedIds = parseSelectedIds(resolvedSearchParams.productIds);
  const qrTarget = parseQrTarget(resolvedSearchParams.qrTarget);
  const [products, labels] = await Promise.all([
    getLabelSelectionList(),
    selectedIds.length ? getPrintableLabels(selectedIds, qrTarget) : Promise.resolve([])
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary">Physical tagging</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl sm:text-5xl">Label generator</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Build small printable product tags with SKU, price, category, and a QR code that resolves to studio inventory or the live product page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button asChild variant={qrTarget === "internal" ? "default" : "outline"}>
            <Link href={buildLabelsHref("internal", selectedIds)}>Internal QR</Link>
          </Button>
          <Button asChild variant={qrTarget === "public" ? "default" : "outline"}>
            <Link href={buildLabelsHref("public", selectedIds)}>Public QR</Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="print:hidden">
          <CardHeader className="border-b bg-white/3">
            <CardTitle className="font-[var(--font-display)] text-3xl">Select products</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form method="get" className="space-y-5">
              <input type="hidden" name="qrTarget" value={qrTarget} />
              <div className="space-y-3">
                {products.map((product) => {
                  const checked = selectedIds.includes(product.id);

                  return (
                    <label
                      key={product.id}
                      className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4"
                    >
                      <div className="flex gap-3">
                        <input type="checkbox" name="productIds" value={product.id} defaultChecked={checked} className="mt-1 size-4" />
                        <div>
                          <p className="font-semibold">{product.title}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{product.category}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={product.isPublished ? "default" : "secondary"}>{formatStatusLabel(product.status)}</Badge>
                        {product.hasPublicUrl ? (
                          <span className="text-xs text-muted-foreground">Public QR ready</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Internal QR only</span>
                        )}
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/app/labels/${product.id}`}>Single label</Link>
                        </Button>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">Generate labels</Button>
                <Button asChild variant="outline">
                  <Link href="/app/labels">Clear selection</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h2 className="font-[var(--font-display)] text-3xl">Print preview</h2>
              <p className="text-sm text-muted-foreground">
                Optimized for standard letter paper now, with reusable label components for future label-printer output.
              </p>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-muted-foreground">
              {labels.length} labels
            </div>
          </div>
          <LabelSheet labels={labels} emptyMessage="Select one or more products to build a label sheet." />
        </div>
      </div>
    </div>
  );
}
