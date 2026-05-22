import OpenAI from "openai";
import { z } from "zod";
import type { StylePreset } from "@/db/schema";
import { env } from "@/lib/env";
import { buildProductImagePrompt } from "@/lib/ai/prompts/product-image";
import { normalizeOutputSize } from "@/lib/style-presets";

const metadataSchema = z.object({
  title: z.string(),
  sku: z.string().optional(),
  description: z.string(),
  materials: z.array(z.string()).default([]),
  collection: z.string(),
  category: z.string(),
  finish: z.string(),
  colorTone: z.string(),
  dimensions: z.string(),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  merchandisingNotes: z.string()
});

type GenerateProductIntelligenceInput = {
  imageFile: File;
  titleHint?: string;
  notes?: string;
  materials?: string;
  targetPrice?: number;
  stylePreset: Pick<
    StylePreset,
    "name" | "description" | "backgroundPrompt" | "lightingPrompt" | "shadowPrompt" | "cropRatio" | "outputSize"
  >;
};

export const PRODUCT_METADATA_MODEL = "gpt-4.1-mini";
export const PRODUCT_STYLING_MODEL = "gpt-image-1";

function getClient() {
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
}

export function buildMetadataPrompt(input: GenerateProductIntelligenceInput) {
  return [
    "You are generating structured ecommerce metadata for handmade jewelry inventory.",
    "Return commercially useful, concise data aligned with a modern luxury boutique brand.",
    `Title hint: ${input.titleHint?.trim() || "None provided"}`,
    `Craft notes: ${input.notes?.trim() || "None provided"}`,
    `Materials: ${input.materials?.trim() || "Unknown"}`,
    `Target price in USD: ${input.targetPrice ?? "Not provided"}`
  ].join("\n");
}

export async function generateProductIntelligence(input: GenerateProductIntelligenceInput) {
  const client = getClient();
  const imageDataUrl = await fileToDataUrl(input.imageFile);
  const metadataPrompt = buildMetadataPrompt(input);
  const stylePrompt = buildProductImagePrompt(
    {
      itemNameIdea: input.titleHint,
      materials: input.materials,
      notes: input.notes
    },
    "primary",
    input.stylePreset
  );

  const metadataResponse = await client.responses.create({
    model: PRODUCT_METADATA_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: metadataPrompt
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "auto"
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "jwld_product_metadata",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            sku: { type: "string" },
            description: { type: "string" },
            materials: { type: "array", items: { type: "string" } },
            collection: { type: "string" },
            category: { type: "string" },
            finish: { type: "string" },
            colorTone: { type: "string" },
            dimensions: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
            merchandisingNotes: { type: "string" }
          },
          required: [
            "title",
            "description",
            "materials",
            "collection",
            "category",
            "finish",
            "colorTone",
            "dimensions",
            "tags",
            "confidence",
            "merchandisingNotes"
          ]
        }
      }
    }
  });

  const metadataText = metadataResponse.output_text;
  const metadata = metadataSchema.parse(JSON.parse(metadataText));

  let styledImageBuffer: Uint8Array | null = null;
  let styledImageContentType = "image/png";
  let styledImageRawResponse: unknown = null;

  try {
    const styledImage = await client.images.edit({
      model: PRODUCT_STYLING_MODEL,
      image: input.imageFile,
      size: normalizeOutputSize(input.stylePreset.outputSize),
      prompt: stylePrompt
    });
    styledImageRawResponse = styledImage;

    const base64Payload = styledImage.data?.[0]?.b64_json;
    if (base64Payload) {
      styledImageBuffer = Uint8Array.from(Buffer.from(base64Payload, "base64"));
      styledImageContentType = "image/png";
    }
  } catch {
    styledImageBuffer = null;
  }

  return {
    model: `${metadataResponse.model} | ${PRODUCT_STYLING_MODEL}`,
    prompt: `${metadataPrompt}\n\n---\n\n${stylePrompt}`,
    rawResponse: {
      metadata: metadataResponse,
      styledImage: styledImageRawResponse
    },
    metadata,
    styledImageBuffer,
    styledImageContentType
  };
}
