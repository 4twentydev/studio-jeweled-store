import { cn } from "@/lib/utils";
import type * as React from "react";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  // biome-ignore lint/a11y/noLabelWithoutControl: this primitive receives htmlFor or nested controls from callers.
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export { Label };
