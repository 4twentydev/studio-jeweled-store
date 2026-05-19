import { NextResponse } from "next/server";
import { z } from "zod";
import { createAiGenerationLog, generateSlug, updateAiGenerationLog } from "@/db/products";
import { getAiGenerationById } from "@/db/queries";
import { uploadFileToBlob, uploadStyledBufferToBlob } from "@/lib/blob";
import {
  generateProductImageVariant,
  generateProductMetadata,
  getErrorMessage,
  PRODUCT_IMAGE_MODEL,
  PRODUCT_METADATA_MODEL
} from "@/lib/ai/openai";
import { assertFeatureEnabled } from "@/lib/env";

export const runtime = "nodejs";

const routeSchema = z.object({
  mode: z.enum(["all", "image", "metadata"]).default("all"),
  generationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  originalImageUrl: z.string().url().optional(),
  itemNameIdea: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  materials: z.string().trim().max(300).optional(),
  quantity: z.coerce.number().int().min(0).default(1),
  estimatedTimeSpent: z.string().trim().max(120).optional(),
  specialDetails: z.string().trim().max(2000).optional()
});

type OperationStatus = "pending" | "processing" | "success" | "failed" | "not_requested";

type PipelineSnapshot = {
  phase: string;
  mode: "all" | "image" | "metadata";
  originalImageUrl: string;
  operations: {
    metadata: { status: OperationStatus; updatedAt: string; errorMessage?: string | null };
    image: { status: OperationStatus; updatedAt: string; errorMessage?: string | null };
    cleanBackground: { status: OperationStatus; updatedAt: string; errorMessage?: string | null };
  };
  metadata?: unknown;
  images?: {
    processedImageUrl?: string | null;
    cleanBackgroundImageUrl?: string | null;
  };
  warnings?: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function readRouteInput(formData: FormData) {
  return routeSchema.parse({
    mode: readString(formData, "mode"),
    generationId: readString(formData, "generationId"),
    productId: readString(formData, "productId"),
    originalImageUrl: readString(formData, "originalImageUrl"),
    itemNameIdea: readString(formData, "itemNameIdea"),
    notes: readString(formData, "notes"),
    materials: readString(formData, "materials"),
    quantity: readString(formData, "quantity"),
    estimatedTimeSpent: readString(formData, "estimatedTimeSpent"),
    specialDetails: readString(formData, "specialDetails")
  });
}

function buildPromptAudit(input: ReturnType<typeof readRouteInput>) {
  return JSON.stringify({
    metadataModel: PRODUCT_METADATA_MODEL,
    imageModel: PRODUCT_IMAGE_MODEL,
    input: {
      itemNameIdea: input.itemNameIdea ?? null,
      notes: input.notes ?? null,
      materials: input.materials ?? null,
      quantity: input.quantity,
      estimatedTimeSpent: input.estimatedTimeSpent ?? null,
      specialDetails: input.specialDetails ?? null
    }
  });
}

function createInitialSnapshot(input: {
  mode: "all" | "image" | "metadata";
  originalImageUrl: string;
}): PipelineSnapshot {
  const requestedMetadata = input.mode === "all" || input.mode === "metadata";
  const requestedImage = input.mode === "all" || input.mode === "image";
  const timestamp = nowIso();

  return {
    phase: "queued",
    mode: input.mode,
    originalImageUrl: input.originalImageUrl,
    operations: {
      metadata: {
        status: requestedMetadata ? "pending" : "not_requested",
        updatedAt: timestamp
      },
      image: {
        status: requestedImage ? "pending" : "not_requested",
        updatedAt: timestamp
      },
      cleanBackground: {
        status: requestedImage ? "pending" : "not_requested",
        updatedAt: timestamp
      }
    },
    warnings: []
  };
}

function setOperationStatus(
  snapshot: PipelineSnapshot,
  key: keyof PipelineSnapshot["operations"],
  status: OperationStatus,
  errorMessage?: string | null
) {
  snapshot.operations[key] = {
    status,
    updatedAt: nowIso(),
    errorMessage: errorMessage ?? null
  };
}

function appendWarning(snapshot: PipelineSnapshot, warning: string) {
  snapshot.warnings = [...(snapshot.warnings ?? []), warning];
}

function coerceSnapshot(value: unknown, fallback: PipelineSnapshot) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  return {
    ...fallback,
    ...value
  } as PipelineSnapshot;
}

export async function POST(request: Request) {
  let generationId: string | null = null;
  let generationSnapshot: PipelineSnapshot | null = null;
  let generationRawResponse: Record<string, unknown> | null = null;
  let promptSummary = "AI generation";

  try {
    assertFeatureEnabled("openai");
    assertFeatureEnabled("blob");
    assertFeatureEnabled("database");

    const formData = await request.formData();
    const input = readRouteInput(formData);
    const imageField = formData.get("image");
    const uploadedFile = imageField instanceof File && imageField.size > 0 ? imageField : null;

    let existingGeneration = input.generationId ? await getAiGenerationById(input.generationId) : null;
    const originalImageUrl =
      input.originalImageUrl ||
      existingGeneration?.inputImageUrl ||
      (uploadedFile ? (await uploadFileToBlob(uploadedFile, "originals")).url : null);

    if (!originalImageUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "A product photo is required."
        },
        { status: 400 }
      );
    }

    const snapshot = coerceSnapshot(existingGeneration?.parsedResponse, createInitialSnapshot({
      mode: input.mode,
      originalImageUrl
    }));
    const rawResponse = (existingGeneration?.rawResponse && typeof existingGeneration.rawResponse === "object"
      ? existingGeneration.rawResponse
      : {}) as Record<string, unknown>;
    rawResponse.prompts =
      rawResponse.prompts && typeof rawResponse.prompts === "object" ? rawResponse.prompts : {};
    generationSnapshot = snapshot;
    generationRawResponse = rawResponse;

    promptSummary = buildPromptAudit(input);

    let generation =
      existingGeneration ??
      (await createAiGenerationLog({
        productId: input.productId ?? null,
        inputImageUrl: originalImageUrl,
        model: `${PRODUCT_METADATA_MODEL} | ${PRODUCT_IMAGE_MODEL}`,
        prompt: promptSummary,
        status: "pending",
        parsedResponse: snapshot,
        rawResponse
      }));
    generationId = generation.id;

    async function persistGeneration(status?: "pending" | "success" | "failed", errorMessage?: string | null) {
      generation = await updateAiGenerationLog({
        generationId: generation.id,
        outputImageUrl: snapshot.images?.processedImageUrl ?? null,
        model: `${PRODUCT_METADATA_MODEL} | ${PRODUCT_IMAGE_MODEL}`,
        prompt: promptSummary,
        rawResponse,
        parsedResponse: snapshot,
        status,
        errorMessage
      });
    }

    snapshot.phase = "running";
    await persistGeneration("pending", null);

    const aiInput = {
      file: uploadedFile,
      imageUrl: originalImageUrl,
      itemNameIdea: input.itemNameIdea,
      notes: input.notes,
      materials: input.materials,
      quantity: input.quantity,
      estimatedTimeSpent: input.estimatedTimeSpent,
      specialDetails: input.specialDetails
    };

    if (input.mode === "all" || input.mode === "metadata") {
      setOperationStatus(snapshot, "metadata", "processing");
      snapshot.phase = "writing_metadata";
      await persistGeneration("pending", null);

      const metadataResult = await generateProductMetadata(aiInput);
      snapshot.metadata = metadataResult.metadata;
      rawResponse.metadata = metadataResult.rawResponse;
      (rawResponse.prompts as Record<string, unknown>).metadata = metadataResult.prompt;
      setOperationStatus(snapshot, "metadata", "success");
      await persistGeneration("pending", null);
    }

    if (input.mode === "all" || input.mode === "image") {
      setOperationStatus(snapshot, "image", "processing");
      snapshot.phase = "processing_image";
      await persistGeneration("pending", null);

      const mainImage = await generateProductImageVariant(aiInput, "primary");
      const imageFilename = `${generateSlug(input.itemNameIdea || "jwld-product") || "jwld-product"}.png`;
      const processedUpload = await uploadStyledBufferToBlob(
        imageFilename,
        mainImage.buffer,
        mainImage.contentType,
        "processed"
      );

      snapshot.images = {
        ...(snapshot.images ?? {}),
        processedImageUrl: processedUpload.url
      };
      rawResponse.image = mainImage.rawResponse;
      (rawResponse.prompts as Record<string, unknown>).image = mainImage.prompt;
      setOperationStatus(snapshot, "image", "success");
      await persistGeneration("pending", null);

      setOperationStatus(snapshot, "cleanBackground", "processing");
      snapshot.phase = "processing_clean_background";
      await persistGeneration("pending", null);

      try {
        const cleanBackgroundImage = await generateProductImageVariant(aiInput, "clean-background");
        const cleanUpload = await uploadStyledBufferToBlob(
          imageFilename,
          cleanBackgroundImage.buffer,
          cleanBackgroundImage.contentType,
          "processed-clean"
        );

        snapshot.images = {
          ...(snapshot.images ?? {}),
          cleanBackgroundImageUrl: cleanUpload.url
        };
        rawResponse.cleanBackgroundImage = cleanBackgroundImage.rawResponse;
        (rawResponse.prompts as Record<string, unknown>).cleanBackgroundImage = cleanBackgroundImage.prompt;
        setOperationStatus(snapshot, "cleanBackground", "success");
      } catch (error) {
        const warning = `Transparent or clean-background variant was not created: ${getErrorMessage(error)}`;
        appendWarning(snapshot, warning);
        setOperationStatus(snapshot, "cleanBackground", "failed", warning);
      }

      await persistGeneration("pending", null);
    }

    snapshot.phase = "completed";
    await persistGeneration("success", null);

    return NextResponse.json({
      ok: true,
      generationId: generation.id,
      productId: generation.productId,
      originalImageUrl,
      processedImageUrl: snapshot.images?.processedImageUrl ?? null,
      cleanBackgroundImageUrl: snapshot.images?.cleanBackgroundImageUrl ?? null,
      metadata: snapshot.metadata ?? null,
      status: snapshot
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.issues[0]?.message ?? "Invalid AI generation request."
        },
        { status: 400 }
      );
    }

    const message = getErrorMessage(error);

    if (generationId && generationSnapshot && generationRawResponse) {
      generationSnapshot.phase = "failed";

      for (const [key, operation] of Object.entries(generationSnapshot.operations)) {
        if (operation.status === "processing" || operation.status === "pending") {
          generationSnapshot.operations[key as keyof PipelineSnapshot["operations"]] = {
            status: "failed",
            updatedAt: nowIso(),
            errorMessage: message
          };
        }
      }

      await updateAiGenerationLog({
        generationId,
        outputImageUrl: generationSnapshot.images?.processedImageUrl ?? null,
        model: `${PRODUCT_METADATA_MODEL} | ${PRODUCT_IMAGE_MODEL}`,
        prompt: promptSummary,
        rawResponse: generationRawResponse,
        parsedResponse: generationSnapshot,
        status: "failed",
        errorMessage: message
      }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
