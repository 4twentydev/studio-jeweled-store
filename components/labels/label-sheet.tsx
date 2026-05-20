import { ProductLabelCard, type ProductLabelCardData } from "@/components/labels/product-label-card";

export function LabelSheet({
  labels,
  emptyMessage
}: {
  labels: ProductLabelCardData[];
  emptyMessage?: string;
}) {
  if (!labels.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/3 px-6 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "No labels selected yet."}
      </div>
    );
  }

  return (
    <section className="label-sheet grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {labels.map((label) => (
        <ProductLabelCard key={label.id} label={label} />
      ))}
    </section>
  );
}
