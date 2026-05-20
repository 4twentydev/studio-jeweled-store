import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveReviewedProductAction,
  archiveProductAction,
  publishReviewedProductAction,
  regenerateProductImageAction,
  regenerateProductTextAction,
  replaceProcessedImageAction,
  saveReviewDraftAction,
  setPrimaryImageAction
} from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_CATEGORIES } from "@/db/products";
import { getReviewProduct } from "@/lib/data/products";

function joinList(values: string[]) {
  return values.join(", ");
}

function ConfidenceMeter({ value }: { value: number | null }) {
  const width = value ?? 0;

  return (
    <div>
      <div className="h-2 rounded-full bg-white/8">
        <div className="h-2 rounded-full bg-primary/70" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{value === null ? "Not available" : `${value}% confidence`}</p>
    </div>
  );
}

function ProductImagePanel({
  title,
  image,
  productId,
  redirectTo,
  isPrimary
}: {
  title: string;
  image:
    | {
        id: string;
        originalUrl: string;
        processedUrl: string | null;
        thumbnailUrl: string | null;
      }
    | null;
  productId: string;
  redirectTo: string;
  isPrimary: boolean;
}) {
  const imageUrl = image?.processedUrl ?? image?.thumbnailUrl ?? image?.originalUrl ?? null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-xl">{title}</CardTitle>
        {isPrimary ? <Badge>Primary</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-square overflow-hidden rounded-3xl border bg-black/30">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} fill className="object-cover" sizes="(max-width: 1200px) 100vw, 40vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image yet</div>
          )}
        </div>
        {image ? (
          <form action={setPrimaryImageAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button type="submit" variant={isPrimary ? "secondary" : "outline"} className="w-full">
              {isPrimary ? "Primary image" : "Set as primary"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function ReviewDetailPage({
  params
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getReviewProduct(productId);

  if (!product) {
    notFound();
  }

  const redirectTo = `/review/${product.id}`;
  const currentPrimaryId = product.primaryImage?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/review" className="text-sm text-muted-foreground transition hover:text-foreground">
            Back to review queue
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl sm:text-5xl">{product.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant={product.status === "approved" ? "default" : "secondary"}>{product.status}</Badge>
            <span className="text-sm text-muted-foreground">Created {product.createdDateLabel}</span>
            <span className="text-sm text-muted-foreground">{product.aiGenerations.length} AI runs logged</span>
          </div>
        </div>
        <div className="grid min-w-[220px] gap-2 rounded-3xl border bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">AI confidence</p>
          <ConfidenceMeter value={product.aiConfidencePercent} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ProductImagePanel
              title="Original upload"
              image={product.originalImage}
              productId={product.id}
              redirectTo={redirectTo}
              isPrimary={currentPrimaryId === product.originalImage?.id}
            />
            <ProductImagePanel
              title="Processed image"
              image={product.processedImage}
              productId={product.id}
              redirectTo={redirectTo}
              isPrimary={currentPrimaryId === product.processedImage?.id}
            />
          </div>

          <form className="space-y-6">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <Card>
              <CardHeader className="flex flex-col gap-4 border-b bg-white/3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="font-[var(--font-display)] text-3xl">Product details</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Edit what AI generated, then save, approve, or publish.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button formAction={saveReviewDraftAction} type="submit" variant="secondary">
                    Save Draft
                  </Button>
                  <Button formAction={approveReviewedProductAction} type="submit">
                    Approve
                  </Button>
                  <Button formAction={publishReviewedProductAction} type="submit" variant="outline">
                    Publish to Store
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 p-6">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="title">Generated title</Label>
                    <Input id="title" name="title" defaultValue={product.title} />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="description">Generated description</Label>
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
                    <Label htmlFor="aiNotes">AI notes</Label>
                    <Textarea id="aiNotes" name="aiNotes" defaultValue={product.aiNotes ?? ""} className="min-h-[120px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" name="category" defaultValue={product.category} list="review-categories" />
                    <datalist id="review-categories">
                      {INITIAL_CATEGORIES.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Input id="subcategory" name="subcategory" defaultValue={product.subcategory ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={product.priceValue.toFixed(2)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compareAtPrice">Compare at price</Label>
                    <Input
                      id="compareAtPrice"
                      name="compareAtPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={product.compareAtPriceValue?.toFixed(2) ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input id="quantity" name="quantity" type="number" min="0" defaultValue={product.quantity} />
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
                      defaultValue={product.aiConfidence === null ? "" : Number(product.aiConfidence).toFixed(2)}
                    />
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
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <form action={regenerateProductImageAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Button type="submit" variant="outline" className="w-full">
                  Regenerate Image
                </Button>
              </form>
              <form action={regenerateProductTextAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Button type="submit" variant="outline" className="w-full">
                  Regenerate Text
                </Button>
              </form>
              <form action={archiveProductAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Button type="submit" variant="ghost" className="w-full">
                  Archive
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">Replace processed image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a replacement without touching the original source image.
              </p>
              <form action={replaceProcessedImageAction} className="space-y-3">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Input name="processedImage" type="file" accept="image/*" />
                <Button type="submit" className="w-full">
                  Replace processed image
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">AI audit trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Every regeneration is logged. Original uploads are kept.</p>
              {product.aiGenerations.length ? (
                <div className="space-y-3">
                  {product.aiGenerations.map((generation) => (
                    <div key={generation.id} className="rounded-2xl border bg-black/20 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant={generation.status === "success" ? "default" : "secondary"}>{generation.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit"
                          }).format(generation.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-muted-foreground">{generation.prompt}</p>
                      {generation.outputImageUrl ? (
                        <a
                          href={generation.outputImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-xs text-primary transition hover:text-primary/80"
                        >
                          Open generated image
                        </a>
                      ) : null}
                      {generation.errorMessage ? (
                        <p className="mt-3 text-xs text-destructive">{generation.errorMessage}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed bg-black/10 p-4 text-sm text-muted-foreground">
                  No AI generations logged yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
