import OpenAI from "openai";
import type { StylePreset } from "@/db/schema";
import { env } from "@/lib/env";
import { buildProductImagePrompt, type ProductImagePromptInput } from "@/lib/ai/prompts/product-image";
import {
  buildProductMetadataPrompt,
  type ProductMetadataPromptInput
} from "@/lib/ai/prompts/product-metadata";
import {
  jwldProductCategories,
  productMetadataSchema,
  type ProductMetadata
} from "@/lib/ai/schemas/product-metadata";
import { normalizeOutputSize } from "@/lib/style-presets";

export const PRODUCT_IMAGE_MODEL = "gpt-image-2";
export const PRODUCT_METADATA_MODEL = "gpt-4.1";

type SourceImageInput = {
  file?: File | null;
  imageUrl?: string | null;
  filenameHint?: string;
};

type RetryOptions = {
  label: string;
  maxAttempts?: number;
  initialDelayMs?: number;
};

export type GeneratedImageVariant = {
  variant: "primary" | "clean-background";
  model: string;
  prompt: string;
  contentType: string;
  buffer: Uint8Array;
  rawResponse: unknown;
};

export type GeneratedMetadata = {
  model: string;
  prompt: string;
  metadata: ProductMetadata;
  rawResponse: unknown;
};

function getClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });
}

function sanitizeForStorage<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;
  const name = error instanceof Error ? error.name : "";

  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    name === "APIConnectionError" ||
    name === "InternalServerError" ||
    name === "RateLimitError"
  );
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown AI pipeline error.";
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions) {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 600;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isTransientError(error)) {
        throw error;
      }

      await sleep(initialDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error(`Retry loop exited unexpectedly for ${options.label}: ${getErrorMessage(lastError)}`);
}

function buildMetadataJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      shortDescription: { type: "string" },
      description: { type: "string" },
      category: {
        type: "string",
        enum: [...jwldProductCategories]
      },
      subcategory: { type: "string" },
      price: { type: "number" },
      compareAtPrice: {
        anyOf: [{ type: "number" }, { type: "null" }]
      },
      quantity: { type: "integer" },
      materials: { type: "array", items: { type: "string" } },
      colors: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      altText: { type: "string" },
      seoTitle: { type: "string" },
      seoDescription: { type: "string" },
      confidence: { type: "number" },
      notesForHuman: { type: "string" }
    },
    required: [
      "title",
      "shortDescription",
      "description",
      "category",
      "subcategory",
      "price",
      "compareAtPrice",
      "quantity",
      "materials",
      "colors",
      "tags",
      "altText",
      "seoTitle",
      "seoDescription",
      "confidence",
      "notesForHuman"
    ]
  };
}

async function sourceImageToFile(input: SourceImageInput) {
  if (input.file) {
    return input.file;
  }

  if (!input.imageUrl) {
    throw new Error("A source image file or image URL is required.");
  }

  const response = await fetch(input.imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch source image: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";
  const extension = contentType.split("/")[1] || "png";

  return new File([buffer], input.filenameHint || `source-image.${extension}`, {
    type: contentType
  });
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
}

function extractBase64Payload(response: unknown) {
  if (
    typeof response === "object" &&
    response &&
    "data" in response &&
    Array.isArray(response.data) &&
    response.data[0] &&
    typeof response.data[0] === "object" &&
    response.data[0] &&
    "b64_json" in response.data[0] &&
    typeof response.data[0].b64_json === "string"
  ) {
    return response.data[0].b64_json;
  }

  throw new Error("OpenAI image response did not include a base64 payload.");
}

export async function generateProductMetadata(
  input: ProductMetadataPromptInput & SourceImageInput
): Promise<GeneratedMetadata> {
  const client = getClient();
  const sourceFile = await sourceImageToFile(input);
  const prompt = buildProductMetadataPrompt(input);
  const imageDataUrl = await fileToDataUrl(sourceFile);

  const response = await withRetry(
    () =>
      client.responses.create({
        model: PRODUCT_METADATA_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt
              },
              {
                type: "input_image",
                image_url: imageDataUrl
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "jwld_product_metadata",
            strict: true,
            schema: buildMetadataJsonSchema()
          }
        }
      }),
    {
      label: "metadata generation"
    }
  );

  const metadata = productMetadataSchema.parse(JSON.parse(response.output_text));

  return {
    model: response.model,
    prompt,
    metadata,
    rawResponse: sanitizeForStorage(response)
  };
}

export async function generateProductImageVariant(
  input: ProductImagePromptInput &
    SourceImageInput & {
      stylePreset: Pick<
        StylePreset,
        "id" | "name" | "description" | "backgroundPrompt" | "lightingPrompt" | "shadowPrompt" | "cropRatio" | "outputSize"
      >;
    },
  variant: "primary" | "clean-background"
): Promise<GeneratedImageVariant> {
  const client = getClient();
  const sourceFile = await sourceImageToFile(input);
  const prompt = buildProductImagePrompt(input, variant, input.stylePreset);

  const response = await withRetry(
    () =>
      client.images.edit({
        model: PRODUCT_IMAGE_MODEL,
        image: sourceFile,
        prompt,
        size: normalizeOutputSize(input.stylePreset.outputSize),
        quality: "high",
        background: variant === "clean-background" ? "transparent" : "opaque",
        output_format: "png"
      }),
    {
      label: `${variant} image generation`
    }
  );

  const base64Payload = extractBase64Payload(response);

  return {
    variant,
    model: PRODUCT_IMAGE_MODEL,
    prompt,
    contentType: "image/png",
    buffer: Uint8Array.from(Buffer.from(base64Payload, "base64")),
    rawResponse: sanitizeForStorage(response)
  };
}
