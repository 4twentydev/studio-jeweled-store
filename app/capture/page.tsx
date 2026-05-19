import { Camera, Sparkles, Wand2 } from "lucide-react";
import { CaptureForm } from "@/components/forms/capture-form";
import { MotionSection } from "@/components/motion/motion-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <MotionSection>
        <Badge className="bg-primary/14 text-primary">Mobile-first intake</Badge>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl sm:text-5xl">Capture a new product</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Upload or take a product photo, add a few notes, and let the pipeline create a styled asset
          plus draft metadata for review.
        </p>
      </MotionSection>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <CaptureForm />

        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {[
              {
                icon: Camera,
                title: "1. Capture",
                description: "Take a square or portrait image directly from Kylie’s phone."
              },
              {
                icon: Wand2,
                title: "2. Restyle",
                description: "Normalize the background, framing, and luxury product-photo treatment."
              },
              {
                icon: Sparkles,
                title: "3. Draft metadata",
                description: "Generate title, SKU suggestion, category, price notes, tags, and description."
              }
            ].map((step) => (
              <div key={step.title} className="rounded-2xl border bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-3 text-primary">
                  <step.icon className="size-4" />
                  <span className="font-medium">{step.title}</span>
                </div>
                <p>{step.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
