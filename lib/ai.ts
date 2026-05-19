import OpenAI from "openai";
import { z } from "zod";
import { env } from "@/lib/env";

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
  titleHint: string;
  notes: string;
  materials: string;
  targetPrice: number;
};

function getClient() {
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
}

function buildMetadataPrompt(input: GenerateProductIntelligenceInput) {
  return [
    "You are generating structured ecommerce metadata for handmade jewelry inventory.",
    "Return commercially useful, concise data aligned with a modern luxury boutique brand.",
    `Title hint: ${input.titleHint}`,
    `Craft notes: ${input.notes}`,
    `Materials: ${input.materials}`,
    `Target price in USD: ${input.targetPrice}`
  ].join("\n");
}

export async function generateProductIntelligence(input: GenerateProductIntelligenceInput) {
  const client = getClient();
  const imageDataUrl = await fileToDataUrl(input.imageFile);
  const metadataPrompt = buildMetadataPrompt(input);

  const metadataResponse = await client.responses.create({
    model: "gpt-4.1-mini",
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
            image_url: imageDataUrl
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

  try {
    const styledImage = await client.images.edit({
      model: "gpt-image-1",
      image: input.imageFile,
      size: "1536x1536",
      prompt:
        "Restyle this jewelry photo into a polished luxury ecommerce asset for JWLD.store. Maintain the original product faithfully. Use a clean dark-neutral background, soft diffused light, crisp edges, subtle shadow, premium color fidelity, and centered boutique composition."
    });

    const base64Payload = styledImage.data?.[0]?.b64_json;
    if (base64Payload) {
      styledImageBuffer = Uint8Array.from(Buffer.from(base64Payload, "base64"));
      styledImageContentType = "image/png";
    }
  } catch {
    styledImageBuffer = null;
  }

  return {
    model: metadataResponse.model,
    prompt: metadataPrompt,
    rawResponse: metadataResponse,
    metadata,
    styledImageBuffer,
    styledImageContentType
  };
}
