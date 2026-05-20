import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/labels/print-button";
import { LabelSheet } from "@/components/labels/label-sheet";
import { Button } from "@/components/ui/button";
import { getPrintableLabels } from "@/lib/data/labels";
import type { LabelQrTarget } from "@/lib/labels";

function parseQrTarget(value: string | string[] | undefined): LabelQrTarget {
  return value === "public" ? "public" : "internal";
}

export default async function ProductLabelsPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productId } = await params;
  const resolvedSearchParams = await searchParams;
  const qrTarget = parseQrTarget(resolvedSearchParams.qrTarget);
  const labels = await getPrintableLabels([productId], qrTarget);

  if (!labels.length) {
    notFound();
  }

  const label = labels[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/app/labels" className="text-sm text-muted-foreground transition hover:text-foreground">
            Back to labels
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl sm:text-5xl">{label.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{label.sku}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button asChild variant={qrTarget === "internal" ? "default" : "outline"}>
            <Link href={`/app/labels/${productId}?qrTarget=internal`}>Internal QR</Link>
          </Button>
          <Button asChild variant={qrTarget === "public" ? "default" : "outline"}>
            <Link href={`/app/labels/${productId}?qrTarget=public`}>Public QR</Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      <LabelSheet labels={labels} />
    </div>
  );
}
