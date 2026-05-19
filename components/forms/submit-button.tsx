"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className={className} disabled={pending}>
      {pending ? "Processing..." : children}
    </Button>
  );
}
