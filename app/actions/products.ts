"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { products, studioSettings } from "@/db/schema";
import { generateProductIntelligence } from "@/lib/ai";
import { assertFeatureEnabled } from "@/lib/env";
import { publishToStorefront } from "@/lib/storefront";
import { uploadFileToBlob, uploadStyledBufferToBlob } from "@/lib/blob";

const captureSchema = z.object({
  titleHint: z.string().trim().min(2),
  notes: z.string().trim().min(10),
  materials: z.string().trim().min(2),
  quantityOnHand: z.coerce.number().int().min(0),
  targetPrice: z.coerce.number().min(0),
  image: z.instanceof(File)
});

const settingsSchema = z.object({
  brandVoice: z.string().trim().min(10),
  defaultMarkupPercent: z.coerce.number().min(0),
  defaultCollection: z.string().trim().min(2),
  publishMode: z.string().trim().min(2)
});

function createSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createSku(title: string) {
  const base = title.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "JWLD";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

function createUniqueSlug(title: string) {
  return `${createSlug(title)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function ingestProductCapture(_: unknown, formData: FormData) {
  const parsed = captureSchema.safeParse({
    titleHint: formData.get("titleHint"),
    notes: formData.get("notes"),
    materials: formData.get("materials"),
    quantityOnHand: formData.get("quantityOnHand"),
    targetPrice: formData.get("targetPrice"),
    image: formData.get("image")
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid submission."
    };
  }

  assertFeatureEnabled("database");
  assertFeatureEnabled("blob");
  assertFeatureEnabled("openai");

  const { image, titleHint, notes, materials, quantityOnHand, targetPrice } = parsed.data;
  const originalUpload = await uploadFileToBlob(image, "originals");
  const intelligence = await generateProductIntelligence({
    titleHint,
    notes,
    materials,
    targetPrice,
    imageFile: image
  });

  const styledUpload = intelligence.styledImageBuffer
    ? await uploadStyledBufferToBlob(
        `${createSlug(intelligence.metadata.title || titleHint)}.png`,
        intelligence.styledImageBuffer,
        intelligence.styledImageContentType
      )
    : originalUpload;

  const db = getDb();
  const insertResult = await db
    .insert(products)
    .values({
      sku: intelligence.metadata.sku || createSku(titleHint),
      slug: createUniqueSlug(intelligence.metadata.title || titleHint),
      title: intelligence.metadata.title || titleHint,
      description: intelligence.metadata.description,
      materials: intelligence.metadata.materials.length ? intelligence.metadata.materials : [materials],
      collection: intelligence.metadata.collection,
      category: intelligence.metadata.category,
      finish: intelligence.metadata.finish,
      colorTone: intelligence.metadata.colorTone,
      dimensions: intelligence.metadata.dimensions,
      priceCents: Math.round(targetPrice * 100),
      quantityOnHand,
      reorderThreshold: 2,
      status: "ready_for_review",
      tags: intelligence.metadata.tags,
      aiModel: intelligence.model,
      aiSummary: {
        confidence: intelligence.metadata.confidence,
        merchandisingNotes: intelligence.metadata.merchandisingNotes
      },
      originalImageUrl: originalUpload.url,
      styledImageUrl: styledUpload.url
    })
    .returning({ id: products.id, title: products.title, styledImageUrl: products.styledImageUrl });

  revalidatePath("/");
  revalidatePath("/capture");
  revalidatePath("/inventory");
  revalidatePath("/review");

  return {
    ok: true,
    message: "Draft created and queued for review.",
    product: insertResult[0]
  };
}

export async function approveProductAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  const db = getDb();

  await db
    .update(products)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(products.id, productId));

  revalidatePath("/review");
  revalidatePath("/inventory");
}

export async function publishProductAction(formData: FormData) {
  const productId = z.string().uuid().parse(formData.get("productId"));
  const db = getDb();

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);

  if (!product) {
    throw new Error("Product not found.");
  }

  await publishToStorefront(product);

  await db
    .update(products)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(products.id, productId));

  revalidatePath("/review");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function saveStudioSettingsAction(formData: FormData) {
  const parsed = settingsSchema.parse({
    brandVoice: formData.get("brandVoice"),
    defaultMarkupPercent: formData.get("defaultMarkupPercent"),
    defaultCollection: formData.get("defaultCollection"),
    publishMode: formData.get("publishMode")
  });

  const db = getDb();

  await db
    .insert(studioSettings)
    .values({
      id: "default",
      ...parsed
    })
    .onConflictDoUpdate({
      target: studioSettings.id,
      set: {
        ...parsed,
        updatedAt: new Date()
      }
    });

  revalidatePath("/settings");
}
