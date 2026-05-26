import {
  approveProductAction,
  archiveProductAction,
  regenerateProductDraftAction
} from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReviewQueue } from "@/lib/data/products";
import { formatCurrency } from "@/lib/format";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

function ConfidenceMeter({ value }: { value: number | null }) {
  const width = value ?? 0;

  return (
    <div className="min-w-[120px]">
      <div className="h-2 rounded-full bg-white/8">
        <div
          className="h-2 rounded-full bg-primary/70"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {value === null ? "Not available" : `${value}% confidence`}
      </p>
    </div>
  );
}

export default async function ReviewPage() {
  const queue = await getReviewQueue();

  if (queue.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl">
            Review queue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fast approval for AI-generated product drafts. Nothing is waiting
            right now.
          </p>
        </div>
        <Card>
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              New captures will appear here automatically. Open capture to
              create the next draft.
            </p>
            <Button asChild>
              <Link href="/capture">Capture a product</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl">
            Review queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Fast approval for AI-generated product drafts. Open a draft, make
            the edits you need, and push it live.
          </p>
        </div>
        <div className="rounded-3xl border bg-white/4 px-4 py-3 text-sm text-muted-foreground">
          {queue.length} items waiting across draft, review, and approved
          states.
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-white/3">
          <CardTitle className="font-[var(--font-display)] text-3xl">
            Pending products
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden min-[980px]:block">
            <div className="grid grid-cols-[92px_1.8fr_1.1fr_0.9fr_1fr_0.9fr_1.4fr] gap-4 border-b px-6 py-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <div>Thumb</div>
              <div>Title</div>
              <div>Category</div>
              <div>Price</div>
              <div>Confidence</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {queue.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[92px_1.8fr_1.1fr_0.9fr_1fr_0.9fr_1.4fr] gap-4 border-b px-6 py-4 last:border-b-0"
              >
                <div className="relative h-20 overflow-hidden rounded-2xl border bg-black/20">
                  <Image
                    src={item.styledImageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="92px"
                  />
                </div>
                <div className="space-y-2">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.createdDateLabel}
                  </div>
                </div>
                <div className="text-sm">{item.category}</div>
                <div className="text-sm">{formatCurrency(item.priceCents)}</div>
                <ConfidenceMeter value={item.aiConfidencePercent} />
                <div>
                  <Badge
                    variant={
                      item.status === "approved" ? "default" : "secondary"
                    }
                  >
                    {item.statusLabel}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={approveProductAction}>
                    <input type="hidden" name="productId" value={item.id} />
                    <Button size="sm" type="submit">
                      Approve
                    </Button>
                  </form>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/review/${item.id}`}>Edit</Link>
                  </Button>
                  <form action={regenerateProductDraftAction}>
                    <input type="hidden" name="productId" value={item.id} />
                    <input type="hidden" name="redirectTo" value="/review" />
                    <Button size="sm" type="submit" variant="outline">
                      Regenerate
                    </Button>
                  </form>
                  <form action={archiveProductAction}>
                    <input type="hidden" name="productId" value={item.id} />
                    <input type="hidden" name="redirectTo" value="/review" />
                    <Button size="sm" type="submit" variant="ghost">
                      Archive
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 p-4 min-[980px]:hidden">
            {queue.map((item) => (
              <Card key={item.id} className="overflow-hidden border-white/10">
                <div className="grid gap-4 p-4 sm:grid-cols-[112px_1fr]">
                  <div className="relative h-28 overflow-hidden rounded-2xl border bg-black/20">
                    <Image
                      src={item.styledImageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{item.title}</h2>
                      <Badge
                        variant={
                          item.status === "approved" ? "default" : "secondary"
                        }
                      >
                        {item.statusLabel}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Category
                        </p>
                        <p className="mt-1">{item.category}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Suggested price
                        </p>
                        <p className="mt-1">
                          {formatCurrency(item.priceCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Created
                        </p>
                        <p className="mt-1">{item.createdDateLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          AI confidence
                        </p>
                        <div className="mt-1">
                          <ConfidenceMeter value={item.aiConfidencePercent} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={approveProductAction}>
                        <input type="hidden" name="productId" value={item.id} />
                        <Button size="sm" type="submit">
                          Approve
                        </Button>
                      </form>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/review/${item.id}`}>Edit</Link>
                      </Button>
                      <form action={regenerateProductDraftAction}>
                        <input type="hidden" name="productId" value={item.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value="/review"
                        />
                        <Button size="sm" type="submit" variant="outline">
                          Regenerate
                        </Button>
                      </form>
                      <form action={archiveProductAction}>
                        <input type="hidden" name="productId" value={item.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value="/review"
                        />
                        <Button size="sm" type="submit" variant="ghost">
                          Archive
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
