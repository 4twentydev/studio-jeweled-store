import Link from "next/link";
import { saveStudioSettingsAction } from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSettingsSnapshot, getStylePresetsData } from "@/lib/data/products";
import {
  exportFormats,
  outputSizes,
  toCategoryValueLines,
  toComplexityMultiplierLines,
  toExampleDescriptionBlocks,
  toLineList,
  toSubcategoryLines,
  toUserLines
} from "@/lib/studio-settings";

function SelectField({
  id,
  name,
  defaultValue,
  options
}: {
  id: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="flex h-12 w-full rounded-2xl border bg-input px-4 py-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export async function SettingsPageContent() {
  const [{ settings, hasStoreApiKey, currencyPreview }, stylePresetData] = await Promise.all([
    getSettingsSnapshot(),
    getStylePresetsData()
  ]);
  const selectedStylePresetId =
    stylePresetData.presets.find((preset) => preset.id === settings.imageStyle.defaultStylePresetId)?.id ??
    stylePresetData.defaultPresetId ??
    stylePresetData.presets[0]?.id ??
    "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl">Settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Manage brand rules, pricing defaults, image output, publishing, categories, and internal users.
          </p>
        </div>
        <div className="rounded-[1.75rem] border bg-white/4 px-4 py-3 text-sm text-muted-foreground">
          Settings are stored server-side and validated before save.
        </div>
      </div>

      <form action={saveStudioSettingsAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Brand Voice</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="productDescriptionPrompt">Product description prompt</Label>
              <Textarea
                id="productDescriptionPrompt"
                name="productDescriptionPrompt"
                rows={6}
                defaultValue={settings.brandVoice.productDescriptionPrompt}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTone">Default tone</Label>
              <Input id="defaultTone" name="defaultTone" defaultValue={settings.brandVoice.defaultTone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wordsToPrefer">Words to prefer</Label>
              <Textarea
                id="wordsToPrefer"
                name="wordsToPrefer"
                rows={5}
                defaultValue={toLineList(settings.brandVoice.wordsToPrefer)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wordsToAvoid">Words to avoid</Label>
              <Textarea
                id="wordsToAvoid"
                name="wordsToAvoid"
                rows={5}
                defaultValue={toLineList(settings.brandVoice.wordsToAvoid)}
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="exampleProductDescriptions">Example product descriptions</Label>
              <Textarea
                id="exampleProductDescriptions"
                name="exampleProductDescriptions"
                rows={8}
                defaultValue={toExampleDescriptionBlocks(settings.brandVoice.exampleProductDescriptions)}
              />
              <p className="text-xs text-muted-foreground">Separate examples with `---` on its own line.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Pricing Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categoryBasePrices">Category base prices</Label>
              <Textarea
                id="categoryBasePrices"
                name="categoryBasePrices"
                rows={8}
                defaultValue={toCategoryValueLines(settings.pricingRules.categoryBasePrices)}
              />
              <p className="text-xs text-muted-foreground">Format: `Category | 48`</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="complexityMultipliers">Complexity multipliers</Label>
              <Textarea
                id="complexityMultipliers"
                name="complexityMultipliers"
                rows={8}
                defaultValue={toComplexityMultiplierLines(settings.pricingRules.complexityMultipliers)}
              />
              <p className="text-xs text-muted-foreground">Format: `Detailed | 1.25`</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oneOfOneMarkupPercent">One-of-one markup %</Label>
              <Input
                id="oneOfOneMarkupPercent"
                name="oneOfOneMarkupPercent"
                type="number"
                step="0.01"
                defaultValue={settings.pricingRules.oneOfOneMarkupPercent}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimumPrice">Minimum price</Label>
              <Input
                id="minimumPrice"
                name="minimumPrice"
                type="number"
                step="0.01"
                defaultValue={settings.pricingRules.minimumPrice}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultCompareAtMarkupPercent">Default compare-at markup %</Label>
              <Input
                id="defaultCompareAtMarkupPercent"
                name="defaultCompareAtMarkupPercent"
                type="number"
                step="0.01"
                defaultValue={settings.pricingRules.defaultCompareAtMarkupPercent}
              />
            </div>
            <div className="rounded-2xl border bg-black/20 p-4 text-sm text-muted-foreground">
              Price preview: {currencyPreview}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-[var(--font-display)] text-2xl">Image Style</CardTitle>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/settings/style-presets">Manage style presets</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultStylePresetId">Default style preset</Label>
              <SelectField
                id="defaultStylePresetId"
                name="defaultStylePresetId"
                defaultValue={selectedStylePresetId}
                options={stylePresetData.presets.map((preset) => ({
                  value: preset.id,
                  label: preset.name
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outputSize">Output size</Label>
              <SelectField
                id="outputSize"
                name="outputSize"
                defaultValue={settings.imageStyle.outputSize}
                options={outputSizes.map((value) => ({ value, label: value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backgroundPreference">Background preference</Label>
              <Input
                id="backgroundPreference"
                name="backgroundPreference"
                defaultValue={settings.imageStyle.backgroundPreference}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cropPreference">Crop preference</Label>
              <Input id="cropPreference" name="cropPreference" defaultValue={settings.imageStyle.cropPreference} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Publishing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="publishMode">Publish mode</Label>
              <SelectField
                id="publishMode"
                name="publishMode"
                defaultValue={settings.publishing.publishMode}
                options={[
                  { value: "export", label: "Export" },
                  { value: "api_push", label: "API push" },
                  { value: "shared_db", label: "Shared DB" }
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeApiUrl">Store API URL</Label>
              <Input
                id="storeApiUrl"
                name="storeApiUrl"
                placeholder="https://store.example.com/api"
                defaultValue={settings.publishing.storeApiUrl ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeApiKey">Store API key</Label>
              <Input id="storeApiKey" name="storeApiKey" type="password" placeholder="Leave blank to keep current key" />
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>Key status</span>
                <Badge variant={hasStoreApiKey ? "default" : "secondary"}>
                  {hasStoreApiKey ? "Configured" : "Missing"}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exportFormat">Export settings</Label>
              <SelectField
                id="exportFormat"
                name="exportFormat"
                defaultValue={settings.publishing.exportFormat}
                options={exportFormats.map((value) => ({ value, label: value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exportFilenamePrefix">Export filename prefix</Label>
              <Input
                id="exportFilenamePrefix"
                name="exportFilenamePrefix"
                defaultValue={settings.publishing.exportFilenamePrefix}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="exportIncludeImages"
                  defaultChecked={settings.publishing.exportIncludeImages}
                  className="size-4 rounded border bg-transparent"
                />
                Include image URLs in exports
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Categories</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categories">Manage categories</Label>
              <Textarea
                id="categories"
                name="categories"
                rows={8}
                defaultValue={toLineList(settings.categories.categories)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategories">Manage subcategories</Label>
              <Textarea
                id="subcategories"
                name="subcategories"
                rows={8}
                defaultValue={toSubcategoryLines(settings.categories.subcategories)}
              />
              <p className="text-xs text-muted-foreground">Format: `Category | Subcategory`</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="users">Simple user list</Label>
            <Textarea id="users" name="users" rows={8} defaultValue={toUserLines(settings.users)} />
            <p className="text-xs text-muted-foreground">Format: `Name | admin`, `Name | creator`, or `Name | reviewer`</p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save settings</Button>
        </div>
      </form>
    </div>
  );
}
