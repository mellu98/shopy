import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { generateImage } from "../services/image-generator.server";
import type { ImageCategory, ImageGenerationInput, GeneratedImage } from "../types";

/**
 * API route: POST /app/api/generate-all-images
 *
 * Generates all 6 image categories sequentially from a single product photo.
 * Returns partial results even if some categories fail.
 */

const ALL_CATEGORIES: ImageCategory[] = [
  "product_photo",
  "lifestyle",
  "ingredients",
  "infographic",
  "how_to_process",
  "social_proof",
];

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const inputJson = formData.get("input") as string;

  if (!inputJson) {
    return json({ error: "Missing input data" }, { status: 400 });
  }

  try {
    const baseInput = JSON.parse(inputJson) as Omit<ImageGenerationInput, "category">;

    if (!baseInput.productImageBase64 || !baseInput.productName) {
      return json(
        { error: "Missing required fields: productImageBase64, productName" },
        { status: 400 }
      );
    }

    if (!baseInput.productImageMimeType) {
      baseInput.productImageMimeType = "image/jpeg";
    }

    const results: Array<{
      category: ImageCategory;
      imageBase64: string;
      mimeType: string;
    }> = [];
    const errors: Array<{ category: ImageCategory; error: string }> = [];

    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
      const category = ALL_CATEGORIES[i];
      try {
        console.log(`[ImageGen] Generating ${category} (${i + 1}/${ALL_CATEGORIES.length})...`);
        const result = await generateImage({
          ...baseInput,
          category,
        });
        results.push({
          category: result.category,
          imageBase64: result.imageBase64,
          mimeType: result.mimeType,
        });
      } catch (err: any) {
        console.error(`[ImageGen] Failed ${category}:`, err.message);
        errors.push({ category, error: err.message || "Generation failed" });
      }

      // Rate limit between generations
      if (i < ALL_CATEGORIES.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return json({
      success: true,
      images: results,
      errors,
      totalGenerated: results.length,
      totalFailed: errors.length,
    });
  } catch (error: any) {
    console.error("[ImageGen] Batch error:", error);
    return json(
      { error: error.message || "Batch image generation failed" },
      { status: 500 }
    );
  }
};
