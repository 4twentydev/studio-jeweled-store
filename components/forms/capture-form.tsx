"use client";

import { AlertCircle, Camera, CheckCircle2, Images, LoaderCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ingestProductCapture } from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CaptureActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
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

const progressSteps = [
  "Uploading photo",
  "Analyzing product",
  "Reformatting image",
  "Writing listing",
  "Ready for review"
] as const;

function CaptureProgress({
  hasFile,
  lastMessage,
  wasSuccessful
}: {
  hasFile: boolean;
  lastMessage: string;
  wasSuccessful: boolean;
}) {
  const { pending } = useFormStatus();
  const [activeStep, setActiveStep] = useState<number>(-1);

  useEffect(() => {
    if (!pending) {
      setActiveStep(wasSuccessful ? progressSteps.length - 1 : -1);
      return;
    }

    setActiveStep(0);
    const timers = [
      window.setTimeout(() => setActiveStep(1), 700),
      window.setTimeout(() => setActiveStep(2), 1900),
      window.setTimeout(() => setActiveStep(3), 3400)
    ];

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [pending, wasSuccessful]);

  if (!hasFile && !pending && !lastMessage) {
    return null;
  }

  return (
    <div className="rounded-[2rem] border bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{pending ? progressSteps[Math.max(activeStep, 0)] : lastMessage || "Ready"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending
              ? "This can take a moment while the draft is prepared."
              : wasSuccessful
                ? "The draft is ready for review."
                : "If something fails, the original photo stays saved."}
          </p>
        </div>
        <Badge variant={pending ? "secondary" : wasSuccessful ? "default" : "outline"}>
          {pending ? "Working" : wasSuccessful ? "Complete" : "Waiting"}
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {progressSteps.map((step, index) => {
          const complete = pending ? index < activeStep : wasSuccessful && index <= activeStep;
          const current = pending && index === activeStep;

          return (
            <div key={step} className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/30">
                {complete ? (
                  <CheckCircle2 className="size-4 text-primary" />
                ) : current ? (
                  <LoaderCircle className="size-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="size-4 text-muted-foreground" />
                )}
              </div>
              <p className={complete || current ? "text-sm text-foreground" : "text-sm text-muted-foreground"}>
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmitRow({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="h-14 w-full rounded-full text-base" disabled={disabled || pending}>
      {pending ? "Generating Product..." : "Generate Product"}
    </Button>
  );
}

export function CaptureForm() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!state.ok || !state.redirectTo) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.push(state.redirectTo!);
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router, state.ok, state.redirectTo]);

  const statusTone = useMemo(() => {
    if (!state.message) {
      return null;
    }

    return state.ok ? "default" : "secondary";
  }, [state.message, state.ok]);

  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-b from-[#141414] to-[#0c0c0c]">
      <CardHeader className="space-y-3 pb-4">
        <Badge className="w-fit bg-primary/15 text-primary">Kylie capture flow</Badge>
        <CardTitle className="font-[var(--font-display)] text-3xl">Create a product from one photo</CardTitle>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Take a quick photo or choose one from your gallery. Add notes only if they help.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <form action={formAction} className="space-y-5">
          <input
            ref={cameraInputRef}
            id="camera-image"
            name="cameraImage"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            className="sr-only"
            required={!file}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              if (galleryInputRef.current) {
                galleryInputRef.current.value = "";
              }
            }}
          />
          <input
            ref={galleryInputRef}
            id="gallery-image"
            name="galleryImage"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            required={!file}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              if (cameraInputRef.current) {
                cameraInputRef.current.value = "";
              }
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              htmlFor="camera-image"
              className="flex min-h-36 cursor-pointer flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-primary/50 hover:bg-white/[0.06]"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Camera className="size-6" />
              </div>
              <div>
                <p className="text-lg font-medium">Take photo</p>
                <p className="mt-1 text-sm text-muted-foreground">Open Kylie&apos;s camera and capture it now.</p>
              </div>
            </label>

            <label
              htmlFor="gallery-image"
              className="flex min-h-36 cursor-pointer flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-primary/50 hover:bg-white/[0.06]"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Images className="size-6" />
              </div>
              <div>
                <p className="text-lg font-medium">Choose from gallery</p>
                <p className="mt-1 text-sm text-muted-foreground">Use an existing photo from the phone.</p>
              </div>
            </label>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-dashed border-white/15 bg-black/25">
            {previewUrl ? (
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src={previewUrl}
                  alt="Selected product preview"
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-sm font-medium text-white">Preview before submitting</p>
                  <p className="text-xs text-white/75">{file?.name}</p>
                </div>
              </div>
            ) : (
              <div className="flex aspect-[4/5] flex-col items-center justify-center px-6 text-center">
                <Camera className="size-10 text-muted-foreground" />
                <p className="mt-4 text-base font-medium">Your photo preview will show here</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                  Use a clear photo with the full product in frame.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <div>
              <p className="font-medium">Optional notes</p>
              <p className="mt-1 text-sm text-muted-foreground">Leave anything blank if you do not need it.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemNameIdea">Item name idea</Label>
              <Input id="itemNameIdea" name="itemNameIdea" placeholder="Butterfly lighter case" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materials">Materials</Label>
              <Input id="materials" name="materials" placeholder="Resin, rhinestones, silver hardware" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" min="0" defaultValue="1" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedTimeSpent">Estimated time spent</Label>
                <Input id="estimatedTimeSpent" name="estimatedTimeSpent" placeholder="2 hours" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialDetails">Special details</Label>
              <Textarea
                id="specialDetails"
                name="specialDetails"
                rows={4}
                placeholder="Color, finish, measurements, inspo, flaws, or anything the AI should notice."
              />
            </div>
          </div>

          <CaptureProgress hasFile={Boolean(file)} lastMessage={state.message} wasSuccessful={state.ok} />

          {state.message && statusTone ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
              <div className="flex items-start gap-3">
                {state.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                ) : (
                  <AlertCircle className="mt-0.5 size-5 text-destructive" />
                )}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={statusTone}>{state.ok ? "Saved" : "Needs attention"}</Badge>
                    <p className="text-sm text-muted-foreground">{state.message}</p>
                  </div>

                  {state.product ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="relative size-16 overflow-hidden rounded-xl border border-white/10">
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
                        <p className="text-xs text-muted-foreground">
                          {state.ok ? "Sending to review..." : "Original photo is still saved."}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <SubmitRow disabled={!file} />
        </form>
      </CardContent>
    </Card>
  );
}
