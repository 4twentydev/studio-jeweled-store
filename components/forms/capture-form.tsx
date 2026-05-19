"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { ingestProductCapture } from "@/app/actions/products";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CaptureActionState = {
  ok: boolean;
  message: string;
  product?: {
    id: string;
    title: string;
    styledImageUrl: string;
  };
};

const initialState: CaptureActionState = {
  ok: false,
  message: ""
};

export function CaptureForm() {
  const [state, formAction] = useActionState(ingestProductCapture, initialState);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-[var(--font-display)] text-2xl">New intake draft</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="image">Product photo</Label>
            <Input
              id="image"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {previewUrl ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border">
              <Image src={previewUrl} alt="Selected product preview" fill className="object-cover" unoptimized />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="titleHint">Title hint</Label>
            <Input id="titleHint" name="titleHint" placeholder="Moonstone drop earrings" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="materials">Materials</Label>
            <Input id="materials" name="materials" placeholder="Sterling silver, freshwater pearl" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Craft notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={5}
              placeholder="Include finish, closure, measurements, inspiration, and any visible details."
              required
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantityOnHand">Quantity on hand</Label>
              <Input id="quantityOnHand" name="quantityOnHand" type="number" min="0" defaultValue="1" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target price (USD)</Label>
              <Input id="targetPrice" name="targetPrice" type="number" min="0" step="0.01" defaultValue="72" required />
            </div>
          </div>
          <SubmitButton className="w-full">Create AI draft</SubmitButton>
        </form>

        {state.message ? (
          <div className="rounded-[1.5rem] border bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <Badge variant={state.ok ? "default" : "secondary"}>{state.ok ? "Saved" : "Needs attention"}</Badge>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
            {state.ok && state.product ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-black/20 p-3">
                <div className="relative size-16 overflow-hidden rounded-xl border">
                  <Image
                    src={state.product.styledImageUrl}
                    alt={state.product.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div>
                  <p className="font-medium">{state.product.title}</p>
                  <p className="text-xs text-muted-foreground">Queued for review</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
