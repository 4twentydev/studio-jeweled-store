import { CaptureForm } from "@/components/forms/capture-form";
import { MotionSection } from "@/components/motion/motion-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <MotionSection>
        <Badge className="bg-primary/14 text-primary">Mobile-first intake</Badge>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl sm:text-5xl">Capture a product</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          One clear photo is enough to start. The original upload is kept as-is, and the AI-prepared draft is sent to
          review when it finishes.
        </p>
      </MotionSection>

      <CaptureForm />

      <Card className="border-white/10 bg-white/[0.03]">
        <CardContent className="grid gap-3 p-5 text-sm text-muted-foreground sm:grid-cols-3">
          <p>Original photos are stored separately and never overwritten.</p>
          <p>AI styling is saved as a second asset, so review always has both versions.</p>
          <p>If AI fails, the saved original still stays attached to the draft.</p>
        </CardContent>
      </Card>
    </div>
  );
}
