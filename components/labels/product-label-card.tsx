import { formatCurrency } from "@/lib/format";

export type ProductLabelCardData = {
  id: string;
  title: string;
  sku: string;
  category: string;
  priceCents: number;
  qrCodeDataUrl: string;
  qrTargetUrl: string;
  qrTargetLabel: string;
};

export function ProductLabelCard({ label }: { label: ProductLabelCardData }) {
  return (
    <article className="label-card flex h-full flex-col justify-between rounded-[0.35in] border border-neutral-300 bg-white p-4 text-black">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          {label.category}
        </p>
        <h2 className="min-h-[2.5rem] font-[var(--font-body)] text-base leading-tight font-semibold">
          {label.title}
        </h2>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_84px] gap-3">
        <div className="space-y-2">
          <p className="text-lg font-semibold">
            {formatCurrency(label.priceCents)}
          </p>
          <p className="break-all font-mono text-[11px] text-neutral-700">
            {label.sku}
          </p>
          <p className="min-h-[1.75rem] text-[10px] leading-relaxed text-neutral-500">
            {label.qrTargetLabel}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-2">
          <img
            src={label.qrCodeDataUrl}
            alt={`QR code for ${label.title}`}
            width={84}
            height={84}
            className="size-[84px]"
          />
        </div>
      </div>
    </article>
  );
}
