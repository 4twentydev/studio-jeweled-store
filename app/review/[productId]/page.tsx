import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveReviewedProductAction,
  archiveProductAction,
  publishReviewedProductAction,
  regenerateProductCategoryTagsAction,
  regenerateProductImageAction,
  regenerateProductPriceAction,
  regenerateProductTextAction,
  replaceProcessedImageAction,
  restoreAiGenerationAction,
  saveReviewDraftAction,
  setPrimaryImageAction,
  tryDifferentStylePresetAction
} from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_CATEGORIES } from "@/db/products";
import {
  creativityLevels,
  descriptionTones,
  priceStrategies
} from "@/lib/ai/generation-options";
import { formatCurrency } from "@/lib/format";
import { getReviewProduct, getStylePresetsData } from "@/lib/data/products";

function joinList(values: string[]) {
  return values.join(", ");
}

function titleCaseOption(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
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
  const [product, stylePresetData] = await Promise.all([getReviewProduct(productId), getStylePresetsData()]);

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

      {product.latestPublishResult ? (
        <Card>
          <CardContent className="flex flex-col gap-2 p-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={product.latestPublishResult.success ? "default" : "secondary"}>
                {product.latestPublishResult.success ? "Last publish succeeded" : "Last publish failed"}
              </Badge>
              <span className="text-muted-foreground">
                {product.latestPublishResult.modeLabel} on {product.latestPublishResult.createdAtLabel}
              </span>
            </div>
            <p>{product.latestPublishResult.message}</p>
          </CardContent>
        </Card>
      ) : null}

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
                  <Button
                    formAction={publishReviewedProductAction}
                    type="submit"
                    variant="outline"
                    disabled={product.status !== "approved"}
                  >
                    Publish to JWLD.store
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
              <CardTitle className="font-[var(--font-display)] text-2xl">AI controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="stylePresetId">Style preset</Label>
                    <select
                      id="stylePresetId"
                      name="stylePresetId"
                      defaultValue={stylePresetData.defaultPresetId ?? undefined}
                      className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
                    >
                      {stylePresetData.presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                          {preset.isDefault ? " (Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="creativity">Creativity</Label>
                      <select
                        id="creativity"
                        name="creativity"
                        defaultValue="medium"
                        className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
                      >
                        {creativityLevels.map((level) => (
                          <option key={level} value={level}>
                            {titleCaseOption(level)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceStrategy">Price strategy</Label>
                      <select
                        id="priceStrategy"
                        name="priceStrategy"
                        defaultValue="standard"
                        className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
                      >
                        {priceStrategies.map((strategy) => (
                          <option key={strategy} value={strategy}>
                            {titleCaseOption(strategy)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descriptionTone">Description tone</Label>
                    <select
                      id="descriptionTone"
                      name="descriptionTone"
                      defaultValue="clean luxury"
                      className="h-11 w-full rounded-full border bg-transparent px-4 text-sm outline-none"
                    >
                      {descriptionTones.map((tone) => (
                        <option key={tone} value={tone}>
                          {titleCaseOption(tone)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="humanInstruction">Human instruction</Label>
                    <Textarea
                      id="humanInstruction"
                      name="humanInstruction"
                      className="min-h-[140px]"
                      placeholder={`Make the title more playful
Price this higher
Use a cleaner white background
Make description shorter
Do not call it a lighter`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Button formAction={regenerateProductImageAction} type="submit" variant="outline" className="w-full">
                      Regenerate image
                    </Button>
                    <Button formAction={regenerateProductTextAction} type="submit" variant="outline" className="w-full">
                      Regenerate title/description
                    </Button>
                    <Button formAction={regenerateProductPriceAction} type="submit" variant="outline" className="w-full">
                      Regenerate price only
                    </Button>
                    <Button
                      formAction={regenerateProductCategoryTagsAction}
                      type="submit"
                      variant="outline"
                      className="w-full"
                    >
                      Regenerate category/tags only
                    </Button>
                    <Button formAction={tryDifferentStylePresetAction} type="submit" variant="outline" className="w-full">
                      Try different style preset
                    </Button>
                  </div>
                </div>
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
              <CardTitle className="font-[var(--font-display)] text-2xl">Current final version</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{product.status}</Badge>
                {product.selectedFinalGeneration ? (
                  <Badge variant="secondary">AI version selected</Badge>
                ) : (
                  <Badge variant="secondary">Manual review state</Badge>
                )}
              </div>
              <div className="rounded-2xl border bg-black/20 p-4">
                <p className="font-medium">{product.title}</p>
                <p className="mt-2 text-muted-foreground">{product.description}</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>Price: {formatCurrency(Math.round(product.priceValue * 100))}</p>
                  <p>Category: {product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}</p>
                  <p>Tags: {product.tags.length ? joinList(product.tags) : "None"}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Human approval remains required before publishing. AI changes only update the review draft.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[var(--font-display)] text-2xl">Generation history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Every regeneration attempt is saved with prompts, options, and restoreable outputs.
              </p>
              {product.aiGenerations.length ? (
                <div className="space-y-3">
                  {product.aiGenerations.map((generation) => (
                    <details key={generation.id} className="rounded-2xl border bg-black/20 p-4 text-sm">
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={generation.status === "success" ? "default" : "secondary"}>
                              {generation.status}
                            </Badge>
                            {generation.isSelectedFinal ? <Badge>Selected final</Badge> : null}
                            <span className="text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit"
                              }).format(generation.createdAt)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">Open details</span>
                        </div>
                      </summary>
                      <div className="mt-4 space-y-3">
                        {generation.stylePreset ? (
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Preset: {generation.stylePreset.name}
                          </p>
                        ) : null}
                        {generation.options ? (
                          <div className="grid gap-1 text-xs text-muted-foreground">
                            <p>Scope: {generation.options.scope}</p>
                            <p>Creativity: {generation.options.creativity}</p>
                            <p>Tone: {generation.options.descriptionTone}</p>
                            <p>Price strategy: {generation.options.priceStrategy}</p>
                          </div>
                        ) : null}
                        {generation.humanInstruction ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                            {generation.humanInstruction}
                          </div>
                        ) : null}
                        {generation.reviewSnapshot?.metadata ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">{generation.reviewSnapshot.metadata.title}</p>
                            <p className="mt-1">
                              {formatCurrency(Math.round(generation.reviewSnapshot.metadata.price * 100))} ·{" "}
                              {generation.reviewSnapshot.metadata.category}
                            </p>
                          </div>
                        ) : null}
                        <p className="text-muted-foreground">{generation.prompt}</p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {generation.outputImageUrl ? (
                            <a
                              href={generation.outputImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-primary transition hover:text-primary/80"
                            >
                              Open generated image
                            </a>
                          ) : null}
                          {generation.status === "success" ? (
                            <form action={restoreAiGenerationAction}>
                              <input type="hidden" name="productId" value={product.id} />
                              <input type="hidden" name="generationId" value={generation.id} />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <Button type="submit" size="sm" variant="outline">
                                Restore this version
                              </Button>
                            </form>
                          ) : null}
                        </div>
                        {generation.errorMessage ? (
                          <p className="text-xs text-destructive">{generation.errorMessage}</p>
                        ) : null}
                      </div>
                    </details>
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
