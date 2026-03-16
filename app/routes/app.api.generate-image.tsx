import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { generateImage } from "../services/image-generator.server";
import type { ImageGenerationInput } from "../types";

/**
 * API route: POST /app/api/generate-image
 * Receives ImageGenerationInput, calls Gemini Flash, returns generated image.
 *
 * The product image is sent as base64 in the request body.
 * The generated image is returned as base64 in the response.
 */
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
    const input: ImageGenerationInput = JSON.parse(inputJson);

    // Validate required fields
    if (!input.productImageBase64 || !input.category || !input.productName) {
      return json(
        { error: "Missing required fields: productImageBase64, category, productName" },
        { status: 400 }
      );
    }

    if (!input.productImageMimeType) {
      input.productImageMimeType = "image/jpeg";
    }

    const result = await generateImage(input);

    return json({
      success: true,
      image: {
        imageBase64: result.imageBase64,
        mimeType: result.mimeType,
        category: result.category,
      },
    });
  } catch (error: any) {
    console.error("[ImageGenerator] Error:", error);
    return json(
      { error: error.message || "Image generation failed" },
      { status: 500 }
    );
  }
};
