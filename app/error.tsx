"use client";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="glass-panel surface-outline max-w-md rounded-3xl border p-8">
        <h2 className="font-[var(--font-display)] text-3xl">Studio error</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {error.message}
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
