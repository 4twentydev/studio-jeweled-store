import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  publishProductAction,
  regenerateProductImageAction,
  regenerateProductTextAction,
  replaceProcessedImageAction,
  saveInventoryProductAction,
  setPrimaryImageAction
} from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasDatabase } from "@/db";
import { INITIAL_CATEGORIES } from "@/db/products";
import { formatCurrency } from "@/lib/format";
import { getInventoryProduct } from "@/lib/data/products";
import { getFeatureStatus } from "@/lib/env";

function formatDate(value: Date | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function joinList(values: string[]) {
  return values.join(", ");
}

export default async function InventoryProductPage({
  params
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getInventoryProduct(productId);

  if (!product) {
    notFound();
  }

  const redirectTo = `/inventory/${product.id}`;
  const inventoryValueCents = product.priceCents * Math.max(product.quantityOnHand, 0);
  const canEdit = hasDatabase();
  const features = getFeatureStatus();
  const canRegenerateText = features.database && features.openai;
  const canRegenerateImage = features.database && features.openai && features.blob;
  const canReplaceImage = features.database && features.blob;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/inventory" className="text-sm text-muted-foreground transition hover:text-foreground">
            Back to inventory
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl sm:text-5xl">{product.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant={product.status === "published" || product.status === "approved" ? "default" : "secondary"}>
              {formatStatusLabel(product.status)}
            </Badge>
            <span className="text-sm text-muted-foreground">SKU {product.sku}</span>
            <span className="text-sm text-muted-foreground">Updated {formatDate(product.updatedAt)}</span>
          </div>
        </div>
        <div className="grid min-w-[240px] gap-2 rounded-[1.75rem] border bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inventory value</p>
          <p className="font-[var(--font-display)] text-4xl">{formatCurrency(inventoryValueCents)}</p>
          <p className="text-sm text-muted-foreground">{product.quantityOnHand} units currently on hand</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <form className="space-y-6" action={saveInventoryProductAction}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <Card>
            <CardHeader className="flex flex-col gap-4 border-b bg-white/3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="font-[var(--font-display)] text-3xl">Product editor</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Manage merchandising copy, pricing, stock, and notes for this item.
                </p>
                {!canEdit ? (
                  <p className="mt-2 text-sm text-muted-foreground">Editing is disabled while the app is running in demo mode.</p>
                ) : null}
              </div>
              <Button type="submit" disabled={!canEdit}>
                Save product
              </Button>
            </CardHeader>
            <CardContent className="grid gap-5 p-6">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" defaultValue={product.title} />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" defaultValue={product.description} className="min-h-[180px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortDescription">Short description</Label>
                  <Textarea
                    id="shortDescription"
                    name="shortDescription"
                    defaultValue={product.shortDescription ?? ""}
                    className="min-h-[120px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiNotes">Notes</Label>
                  <Textarea id="aiNotes" name="aiNotes" defaultValue={product.aiNotes ?? ""} className="min-h-[120px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" defaultValue={product.category} list="inventory-categories" />
                  <datalist id="inventory-categories">
                    {INITIAL_CATEGORIES.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Collection / subcategory</Label>
                  <Input id="subcategory" name="subcategory" defaultValue={product.subcategory ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" name="price" type="number" min="0" step="0.01" defaultValue={product.priceValue.toFixed(2)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compareAtPrice">Compare at price</Label>
                  <Input
                    id="compareAtPrice"
                    name="compareAtPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={product.compareAtPriceValue?.toFixed(2) ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Inventory quantity</Label>
                  <Input id="quantity" name="quantity" type="number" min="0" defaultValue={product.quantityOnHand} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={product.status}
                    className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="approved">Approved</option>
                    <option value="archived">Archived</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materials">Materials</Label>
                  <Textarea id="materials" name="materials" defaultValue={joinList(product.materials)} className="min-h-[110px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="colors">Colors</Label>
                  <Textarea id="colors" name="colors" defaultValue={joinList(product.colors)} className="min-h-[110px]" />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Textarea id="tags" name="tags" defaultValue={joinList(product.tags)} className="min-h-[110px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiConfidence">AI confidence</Label>
                  <Input
                    id="aiConfidence"
                    name="aiConfidence"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    defaultValue={product.aiConfidence === null ? "" : product.aiConfidence.toFixed(2)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">Studio summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-[1.25rem] border bg-black/20 px-4 py-3">
                <span className="text-muted-foreground">Published</span>
                <span>{product.isPublished ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.25rem] border bg-black/20 px-4 py-3">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(product.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.25rem] border bg-black/20 px-4 py-3">
                <span className="text-muted-foreground">Published at</span>
                <span>{formatDate(product.publishedAt)}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.25rem] border bg-black/20 px-4 py-3">
                <span className="text-muted-foreground">Metadata health</span>
                <span>{product.hasMetadataGaps ? "Needs attention" : "Healthy"}</span>
              </div>
              <div className="rounded-[1.25rem] border bg-black/20 px-4 py-3">
                <p className="text-muted-foreground">Last publish result</p>
                <p className="mt-1">
                  {product.latestPublishResult
                    ? `${product.latestPublishResult.message} (${product.latestPublishResult.createdAtLabel})`
                    : "No publish attempts recorded yet."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">Publishing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <form action={publishProductAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Button type="submit" className="w-full" disabled={!canEdit || product.status !== "approved"}>
                  Publish to JWLD.store
                </Button>
              </form>
              <Button asChild variant="outline">
                <Link href="/inventory/export?approvedOnly=true&format=json">Export approved products</Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                Only approved products can publish. Export mode prepares JSON or CSV for manual JWLD.store import.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="font-[var(--font-display)] text-2xl">Image gallery manager</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {product.images.map((image) => {
                  const imageUrl = image.processedUrl ?? image.thumbnailUrl ?? image.originalUrl;

                  return (
                    <div key={image.id} className="rounded-[1.5rem] border p-3">
                      <div className="relative aspect-square overflow-hidden rounded-[1.25rem] border bg-black/30">
                        <Image
                          src={imageUrl}
                          alt={image.altText ?? product.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1280px) 100vw, 320px"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={image.isPrimary ? "default" : "outline"}>
                            {image.isPrimary ? "Primary" : "Gallery"}
                          </Badge>
                          <Badge variant="secondary">{formatStatusLabel(image.imageKind)}</Badge>
                        </div>
                        <form action={setPrimaryImageAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="imageId" value={image.id} />
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <Button
                            size="sm"
                            type="submit"
                            variant={image.isPrimary ? "secondary" : "outline"}
                            disabled={!canEdit}
                          >
                            {image.isPrimary ? "Primary image" : "Set primary"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form action={replaceProcessedImageAction} className="grid gap-3 rounded-[1.5rem] border p-4">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <div>
                  <p className="font-medium">Upload replacement processed image</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a new polished image version and make it the primary studio asset.
                  </p>
                </div>
                <Input name="processedImage" type="file" accept="image/*" />
                <Button type="submit" variant="outline" disabled={!canReplaceImage}>
                  Save processed image
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">AI generation history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {product.aiGenerations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI history has been logged for this item yet.</p>
              ) : (
                product.aiGenerations.map((generation) => (
                  <div key={generation.id} className="rounded-[1.5rem] border bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{generation.model}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(generation.createdAt)}</p>
                      </div>
                      <Badge variant={generation.status === "success" ? "default" : "secondary"}>{generation.status}</Badge>
                    </div>
                    {generation.stylePreset ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Preset: {generation.stylePreset.name}
                      </p>
                    ) : null}
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{generation.prompt}</p>
                    {generation.errorMessage ? <p className="mt-2 text-sm text-red-300">{generation.errorMessage}</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <form action={regenerateProductTextAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Button className="w-full" type="submit" variant="secondary" disabled={!canRegenerateText}>
                  Regenerate metadata
                </Button>
              </form>
              <form action={regenerateProductImageAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Button className="w-full" type="submit" variant="outline" disabled={!canRegenerateImage}>
                  Regenerate image
                </Button>
              </form>
              <Button asChild className="w-full" variant="ghost">
                <Link href={`/review/${product.id}`}>Open review workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">Publish history</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-[1.5rem] border border-dashed bg-black/20 p-4 text-sm text-muted-foreground">
                Latest publish results now appear in the studio summary. A full event timeline can build on the saved
                `publish_results` records later without changing the publishing flow again.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
