import Link from "next/link";
import { saveStylePresetAction, setDefaultStylePresetAction } from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getStylePresetsData } from "@/lib/data/products";

function PresetForm({
  preset,
  isDefault
}: {
  preset: {
    id: string;
    name: string;
    description: string | null;
    backgroundPrompt: string;
    lightingPrompt: string;
    shadowPrompt: string;
    cropRatio: string;
    outputSize: string;
    exampleImageUrls: string[];
    isDefault: boolean;
  };
  isDefault: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 border-b bg-white/3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-[var(--font-display)] text-2xl">{preset.name}</CardTitle>
            {isDefault ? <Badge>Default</Badge> : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{preset.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setDefaultStylePresetAction}>
            <input type="hidden" name="stylePresetId" value={preset.id} />
            <Button size="sm" type="submit" variant={isDefault ? "secondary" : "outline"}>
              {isDefault ? "Current default" : "Set default"}
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form action={saveStylePresetAction} className="grid gap-5">
          <input type="hidden" name="presetId" value={preset.id} />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`name-${preset.id}`}>Name</Label>
              <Input id={`name-${preset.id}`} name="name" defaultValue={preset.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`cropRatio-${preset.id}`}>Crop ratio</Label>
              <Input id={`cropRatio-${preset.id}`} name="cropRatio" defaultValue={preset.cropRatio} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor={`description-${preset.id}`}>Description</Label>
              <Textarea id={`description-${preset.id}`} name="description" defaultValue={preset.description ?? ""} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`outputSize-${preset.id}`}>Output size</Label>
              <Input id={`outputSize-${preset.id}`} name="outputSize" defaultValue={preset.outputSize} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={preset.isDefault}
                  className="size-4 rounded border bg-transparent"
                />
                Save as default preset
              </label>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor={`backgroundPrompt-${preset.id}`}>Background prompt</Label>
              <Textarea
                id={`backgroundPrompt-${preset.id}`}
                name="backgroundPrompt"
                defaultValue={preset.backgroundPrompt}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`lightingPrompt-${preset.id}`}>Lighting prompt</Label>
              <Textarea
                id={`lightingPrompt-${preset.id}`}
                name="lightingPrompt"
                defaultValue={preset.lightingPrompt}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`shadowPrompt-${preset.id}`}>Shadow prompt</Label>
              <Textarea id={`shadowPrompt-${preset.id}`} name="shadowPrompt" defaultValue={preset.shadowPrompt} rows={4} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor={`exampleImageUrls-${preset.id}`}>Example image URLs</Label>
              <Textarea
                id={`exampleImageUrls-${preset.id}`}
                name="exampleImageUrls"
                defaultValue={preset.exampleImageUrls.join("\n")}
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Save preset</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export async function StylePresetsPageContent() {
  const { presets, defaultPresetId } = await getStylePresetsData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/app/settings" className="text-sm text-muted-foreground transition hover:text-foreground">
            Back to settings
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl sm:text-5xl">Style presets</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Define how AI stages product photos. Presets may change background, lighting, crop, shadow, and presentation,
            but must preserve the actual item exactly.
          </p>
        </div>
        <div className="rounded-[1.75rem] border bg-white/4 px-4 py-3 text-sm text-muted-foreground">
          {presets.length} presets configured
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-[var(--font-display)] text-2xl">Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>Style changes affect background, crop, lighting, shadow, and presentation only.</p>
          <p>Prompts explicitly preserve the product’s design, proportions, materials, and decoration.</p>
          <p>The default preset is used automatically during capture unless another preset is chosen later for regeneration.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {presets.map((preset) => (
          <PresetForm key={preset.id} preset={preset} isDefault={preset.id === defaultPresetId} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-[var(--font-display)] text-2xl">Add preset</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveStylePresetAction} className="grid gap-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" name="name" placeholder="Preset name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-cropRatio">Crop ratio</Label>
                <Input id="new-cropRatio" name="cropRatio" placeholder="1:1 or 4:5" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="new-description">Description</Label>
                <Textarea id="new-description" name="description" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-outputSize">Output size</Label>
                <Input id="new-outputSize" name="outputSize" placeholder="1024x1024" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="isDefault" className="size-4 rounded border bg-transparent" />
                  Make this the default preset
                </label>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="new-backgroundPrompt">Background prompt</Label>
                <Textarea id="new-backgroundPrompt" name="backgroundPrompt" rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-lightingPrompt">Lighting prompt</Label>
                <Textarea id="new-lightingPrompt" name="lightingPrompt" rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-shadowPrompt">Shadow prompt</Label>
                <Textarea id="new-shadowPrompt" name="shadowPrompt" rows={4} />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="new-exampleImageUrls">Example image URLs</Label>
                <Textarea id="new-exampleImageUrls" name="exampleImageUrls" rows={4} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create preset</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
