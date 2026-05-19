import { saveStudioSettingsAction } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { env, getFeatureStatus } from "@/lib/env";
import { getSettingsSnapshot } from "@/lib/data/products";

export default async function SettingsPage() {
  const settings = await getSettingsSnapshot();
  const features = getFeatureStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure AI, storage, database, and storefront publishing defaults.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Studio defaults</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveStudioSettingsAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="brandVoice">Brand voice</Label>
                <Textarea
                  id="brandVoice"
                  name="brandVoice"
                  defaultValue={settings.brandVoice}
                  rows={6}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultMarkupPercent">Default markup %</Label>
                  <Input
                    id="defaultMarkupPercent"
                    name="defaultMarkupPercent"
                    type="number"
                    defaultValue={settings.defaultMarkupPercent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultCollection">Default collection</Label>
                  <Input
                    id="defaultCollection"
                    name="defaultCollection"
                    defaultValue={settings.defaultCollection}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="publishMode">Publishing mode</Label>
                <Input id="publishMode" name="publishMode" defaultValue={settings.publishMode} />
              </div>
              <Button type="submit">Save settings</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Environment status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(features).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl border bg-black/20 px-4 py-3">
                <span className="font-medium">{key}</span>
                <span className={enabled ? "text-primary" : "text-muted-foreground"}>
                  {enabled ? "Connected" : "Missing"}
                </span>
              </div>
            ))}
            <div className="rounded-2xl border bg-black/20 p-4 text-muted-foreground">
              <p>APP_URL: {env.APP_URL}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
