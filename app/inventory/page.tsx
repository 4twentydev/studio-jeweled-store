import Image from "next/image";
import Link from "next/link";
import {
  approveSelectedProductsAction,
  archiveSelectedProductsAction,
  generateSelectedMetadataAction,
  markSelectedSoldAction
} from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { getInventoryPageData, type InventoryListItem } from "@/lib/data/products";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function formatStatusLabel(status: InventoryListItem["status"]) {
  return status.replaceAll("_", " ");
}

function getStatusVariant(status: InventoryListItem["status"]) {
  if (status === "published" || status === "approved") {
    return "default";
  }

  if (status === "archived" || status === "sold") {
    return "outline";
  }

  return "secondary";
}

function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="bg-card/90">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
        <p className="mt-3 font-[var(--font-display)] text-4xl">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function InventoryCard({ item }: { item: InventoryListItem }) {
  return (
    <Card className="overflow-hidden border-white/10">
      <div className="grid gap-4 p-4 sm:grid-cols-[124px_1fr]">
        <div className="space-y-3">
          <div className="relative h-32 overflow-hidden rounded-[1.5rem] border bg-black/20">
            <Image src={item.styledImageUrl} alt={item.title} fill className="object-cover" sizes="124px" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input className="size-4 rounded border bg-transparent" type="checkbox" name="productIds" value={item.id} />
            Select
          </label>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{item.sku}</p>
              <h2 className="mt-1 font-[var(--font-display)] text-3xl">{item.title}</h2>
            </div>
            <Badge variant={getStatusVariant(item.status)}>{formatStatusLabel(item.status)}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Category</p>
              <p className="mt-1">{item.category}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Price</p>
              <p className="mt-1">{formatCurrency(item.priceCents)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Quantity</p>
              <p className="mt-1">{item.quantityOnHand}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last updated</p>
              <p className="mt-1">{formatDate(item.updatedAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {item.quantityOnHand <= 3 ? <Badge variant="outline">Low stock</Badge> : null}
            {!item.isPublished ? <Badge variant="secondary">Unpublished</Badge> : null}
            {item.hasMetadataGaps ? <Badge variant="secondary">Needs metadata</Badge> : null}
            {item.isSold ? <Badge variant="outline">Sold</Badge> : <Badge variant="outline">Available</Badge>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/inventory/${item.id}`}>Open editor</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/review/${item.id}`}>Review view</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default async function InventoryPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = {
    q: typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : undefined,
    status: typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : undefined,
    category: typeof resolvedSearchParams.category === "string" ? resolvedSearchParams.category : undefined,
    quantity: typeof resolvedSearchParams.quantity === "string" ? resolvedSearchParams.quantity : undefined,
    published: typeof resolvedSearchParams.published === "string" ? resolvedSearchParams.published : undefined,
    availability: typeof resolvedSearchParams.availability === "string" ? resolvedSearchParams.availability : undefined,
    sort: typeof resolvedSearchParams.sort === "string" ? resolvedSearchParams.sort : undefined
  };

  const { items, stats, categories, appliedFilters, filteredCount, totalItems, lowStockThreshold } =
    await getInventoryPageData(filters);

  const readyToPublishCount = items.filter((item) => item.status === "approved" && !item.isPublished).length;
  const metadataGapCount = items.filter((item) => item.hasMetadataGaps).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl">Inventory dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Track stock, publishing readiness, metadata gaps, and item value across the studio catalog.
          </p>
        </div>
        <div className="rounded-[1.75rem] border bg-white/4 px-4 py-3 text-sm text-muted-foreground">
          <div>Showing {filteredCount} of {totalItems} products</div>
          <div className="mt-2">
            <Link href="/app/labels" className="text-primary transition hover:text-primary/80">
              Open label generator
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total products" value={stats.totalProducts} hint="All active inventory records" />
        <StatCard label="Drafts" value={stats.drafts} hint="Still being staged or edited" />
        <StatCard label="Approved" value={stats.approved} hint="Ready for publishing or release" />
        <StatCard label="Published" value={stats.published} hint="Currently visible to shoppers" />
        <StatCard label="Sold" value={stats.sold} hint="Marked sold or no longer available" />
        <StatCard label="Low quantity" value={stats.lowQuantity} hint={`At or below ${lowStockThreshold} on hand`} />
        <StatCard
          label="Inventory value"
          value={formatCurrency(stats.estimatedInventoryValueCents)}
          hint="Estimated retail value of on-hand stock"
        />
        <Card className="bg-card/90">
          <CardContent className="grid gap-3 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Action center</p>
              <p className="mt-3 font-[var(--font-display)] text-3xl">{readyToPublishCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">Approved items still waiting to be published</p>
            </div>
            <div className="rounded-[1.25rem] border bg-black/20 p-3">
              <p className="text-sm text-muted-foreground">{metadataGapCount} filtered items need metadata cleanup.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b bg-white/3">
          <CardTitle className="font-[var(--font-display)] text-3xl">Search and filters</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground" htmlFor="q">
                Search products
              </label>
              <Input id="q" name="q" defaultValue={appliedFilters.q} placeholder="Search title, SKU, tags, category" />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={appliedFilters.status}
                className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                defaultValue={appliedFilters.category}
                className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground" htmlFor="quantity">
                Quantity
              </label>
              <select
                id="quantity"
                name="quantity"
                defaultValue={appliedFilters.quantity}
                className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
              >
                <option value="all">All quantities</option>
                <option value="out">Out of stock</option>
                <option value="low">Low stock</option>
                <option value="in">Healthy stock</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground" htmlFor="published">
                Publish state
              </label>
              <select
                id="published"
                name="published"
                defaultValue={appliedFilters.published}
                className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
              >
                <option value="all">All items</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground" htmlFor="availability">
                Sold / available
              </label>
              <select
                id="availability"
                name="availability"
                defaultValue={appliedFilters.availability}
                className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
              >
                <option value="all">All availability</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground" htmlFor="sort">
                Sort by
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={appliedFilters.sort}
                className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price_high">Price high</option>
                <option value="price_low">Price low</option>
                <option value="category">Category</option>
                <option value="quantity">Quantity</option>
              </select>
            </div>
            <div className="flex items-end gap-2 xl:justify-end">
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="ghost">
                <Link href="/inventory">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <form className="space-y-4">
        <Card>
          <CardHeader className="flex flex-col gap-4 border-b bg-white/3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-[var(--font-display)] text-3xl">Catalog operations</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Select items to move them through approval, archive old records, mark sold pieces, or export catalog data.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button formAction={approveSelectedProductsAction} size="sm" type="submit">
                Approve selected
              </Button>
              <Button formAction={archiveSelectedProductsAction} size="sm" type="submit" variant="secondary">
                Archive selected
              </Button>
              <Button formAction={markSelectedSoldAction} size="sm" type="submit" variant="outline">
                Mark sold
              </Button>
              <Button formAction="/inventory/export" formMethod="get" size="sm" type="submit" variant="ghost">
                Export selected as CSV
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/inventory/export?approvedOnly=true&format=json">Export approved products</Link>
              </Button>
              <Button formAction={generateSelectedMetadataAction} size="sm" type="submit" variant="outline">
                Generate missing metadata
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                No products match the current filters.
              </div>
            ) : (
              <>
                <div className="grid gap-4 p-4 lg:hidden">
                  {items.map((item) => (
                    <InventoryCard key={item.id} item={item} />
                  ))}
                </div>

                <div className="hidden lg:block">
                  <div className="grid grid-cols-[52px_88px_1.7fr_1fr_0.9fr_0.8fr_0.9fr_1fr_0.9fr] gap-4 border-b px-6 py-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    <div>Select</div>
                    <div>Image</div>
                    <div>Product</div>
                    <div>Category</div>
                    <div>Price</div>
                    <div>Qty</div>
                    <div>Status</div>
                    <div>Last updated</div>
                    <div>Actions</div>
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[52px_88px_1.7fr_1fr_0.9fr_0.8fr_0.9fr_1fr_0.9fr] gap-4 border-b px-6 py-4 text-sm last:border-b-0"
                    >
                      <div className="pt-7">
                        <input className="size-4 rounded border bg-transparent" type="checkbox" name="productIds" value={item.id} />
                      </div>
                      <div className="relative h-20 overflow-hidden rounded-[1.25rem] border bg-black/20">
                        <Image src={item.styledImageUrl} alt={item.title} fill className="object-cover" sizes="88px" />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.sku}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.quantityOnHand <= 3 ? <Badge variant="outline">Low stock</Badge> : null}
                          {item.hasMetadataGaps ? <Badge variant="secondary">Needs metadata</Badge> : null}
                        </div>
                      </div>
                      <div>{item.category}</div>
                      <div>{formatCurrency(item.priceCents)}</div>
                      <div>{item.quantityOnHand}</div>
                      <div>
                        <Badge variant={getStatusVariant(item.status)}>{formatStatusLabel(item.status)}</Badge>
                      </div>
                      <div className="text-muted-foreground">{formatDate(item.updatedAt)}</div>
                      <div className="flex flex-col gap-2">
                        <Button asChild size="sm">
                          <Link href={`/inventory/${item.id}`}>Open</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/review/${item.id}`}>Review</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
