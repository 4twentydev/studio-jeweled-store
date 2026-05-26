import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { MotionSection } from "@/components/motion/motion-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/data/products";
import {
  ArrowRight,
  Camera,
  Package,
  Sparkles,
  UploadCloud
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <MotionSection className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden border-primary/15 bg-transparent">
          <CardContent className="relative space-y-5 p-6 sm:p-8">
            <div className="absolute inset-0 luxury-grid opacity-40" />
            <Badge className="relative bg-primary/14 text-primary">
              Inventory command center
            </Badge>
            <div className="relative space-y-3">
              <h1 className="max-w-xl font-[var(--font-display)] text-4xl leading-none sm:text-6xl">
                Photograph, refine, review, and publish from one mobile
                workflow.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                JWLD Studio is built for fast product intake: shoot the piece,
                standardize the image, generate metadata, then move it through
                approval and JWLD.store publishing.
              </p>
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/capture">
                  Open Capture Flow
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/review">Review Queue</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80">
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">
              Today’s intake
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                icon: Camera,
                label: "New captures",
                value: data.metrics.newCapturesToday
              },
              {
                icon: Sparkles,
                label: "AI jobs completed",
                value: data.metrics.aiProcessedToday
              },
              {
                icon: UploadCloud,
                label: "Published today",
                value: data.metrics.publishedToday
              }
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl border bg-black/20 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <item.icon className="size-4" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                </div>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </MotionSection>

      <DashboardMetrics metrics={data.metrics} />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">
              Review priority
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.reviewQueue.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.statusLabel} • {item.inventoryStatus}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/review">Open</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-[var(--font-display)] text-2xl">
              Low stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.lowStock.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border bg-black/20 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent/12 p-2 text-accent">
                    <Package className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU {item.sku}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-primary">
                  {item.quantityOnHand} left
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
