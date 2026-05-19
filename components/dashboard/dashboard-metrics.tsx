import { Activity, Package, Sparkles, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const icons = [Sparkles, Package, TriangleAlert, Activity];

export function DashboardMetrics({
  metrics
}: {
  metrics: {
    itemsInInventory: number;
    readyForReview: number;
    lowStockCount: number;
    publishReady: number;
    newCapturesToday: number;
    aiProcessedToday: number;
    publishedToday: number;
  };
}) {
  const items = [
    { label: "Items in inventory", value: metrics.itemsInInventory },
    { label: "Ready for review", value: metrics.readyForReview },
    { label: "Low stock alerts", value: metrics.lowStockCount },
    { label: "Publish ready", value: metrics.publishReady }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = icons[index];
        return (
          <Card key={item.label} className="bg-card/84">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-3 font-[var(--font-display)] text-4xl">{item.value}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
