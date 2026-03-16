import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { generateCopy } from "../services/copy-generator.server";
import type { CopyGenerationInput } from "../types";

/**
 * API route: POST /app/api/generate-copy
 * Receives CopyGenerationInput, calls AI, returns GeneratedCopy.
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
    const input: CopyGenerationInput = JSON.parse(inputJson);

    // Validate required fields
    if (!input.productName || !input.productDescription || !input.buyerPersona || !input.negativeReviews) {
      return json(
        { error: "Missing required fields: productName, productDescription, buyerPersona, negativeReviews" },
        { status: 400 }
      );
    }

    const copy = await generateCopy(input);
    return json({ success: true, copy });
  } catch (error: any) {
    console.error("[CopyGenerator] Error:", error);
    return json(
      { error: error.message || "Copy generation failed" },
      { status: 500 }
    );
  }
};
