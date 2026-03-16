import type { ImageCategory, ImageGenerationInput, GeneratedImage } from "~/types";

/**
 * AI Image Generator — Ecommerce Visual Art Director
 * Uses Gemini 3.1 Flash (via OpenRouter) for image generation.
 *
 * Flow:
 * 1. Merchant uploads product image + selects category
 * 2. We build a detailed prompt based on category rules
 * 3. Send product image + prompt to Gemini Flash (image generation model)
 * 4. Receive generated image back
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }
  return key;
}

function getImageModel(): string {
  return process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-3.1-flash-image-preview";
}

// ─── Category-Specific Prompt Rules ─────────────────────────────

const CATEGORY_PROMPTS: Record<ImageCategory, string> = {
  product_photo: `CATEGORY: Product Photo (Packshot Studio)
VISUAL RULES:
- Clean studio packshot on neutral background (white or very light grey)
- Soft, natural drop shadow beneath the product
- No graphics, no overlays, no text whatsoever
- Product must be perfectly centered and fill ~70% of the frame
- Lighting: professional studio lighting, soft and even, slight highlights on edges
- The product must look premium, sharp, and photorealistic
- No props, no decorations — only the product itself
- Maintain exact colors, proportions, labels, and materials from the reference image`,

  lifestyle: `CATEGORY: Lifestyle
VISUAL RULES:
- Place the product in a realistic, contextually appropriate environment
- The scene must feel natural and aspirational — like a real photograph
- Use minimal but relevant props that complement the product (not distract)
- Lighting: natural light or realistic studio light, warm and inviting
- The product must remain sharp, centered, and clearly the hero of the image
- Background should be slightly soft/blurred to keep focus on the product
- No text overlays unless absolutely coherent with the scene
- If text is present, it MUST be in Italian
- The environment must match the product's niche and target audience
- Maintain exact product appearance: colors, shape, label, materials`,

  ingredients: `CATEGORY: Ingredients
VISUAL RULES:
- Show key ingredients orbiting or arranged around the product
- Ingredients should be fresh, photorealistic, and visually appealing
- Do NOT cover or obscure the product label — it must remain fully readable
- Mood: premium, clean, beauty-style with soft lighting
- Background: clean gradient or soft neutral tone
- Each ingredient should be clearly identifiable
- Include 3-5 key ingredients maximum
- Benefits text in Italian if included (max 5 words per benefit)
- Layout: ingredients arranged symmetrically or in a balanced composition
- Light: soft beauty lighting, slightly warm, with gentle highlights on ingredients`,

  infographic: `CATEGORY: Infographic
VISUAL RULES:
- Product centered with 4-6 informational callouts arranged around it
- Each callout: icon + short Italian text (max 5 words)
- Icons must be consistent in style (all line icons, or all filled icons)
- Layout: clean, organized, high readability
- Connecting lines or arrows from callouts to relevant product areas
- Background: white or very light, professional
- Typography: clean, modern sans-serif
- Color scheme: consistent with product branding
- ALL TEXT MUST BE IN ITALIAN
- Headline max 6 words
- Each callout text max 5 words
- No cluttered elements — breathing space between callouts`,

  how_to_process: `CATEGORY: How To / Process
VISUAL RULES:
- Show 3-5 sequential steps for using the product
- Layout: horizontal panels, vertical grid, or numbered sequence
- Each step: clear numbered indicator + brief Italian instruction (max 6 words)
- Use arrows, lines, or visual flow indicators between steps
- The product must appear in at least the first and last step
- Each step image should be clear and self-explanatory
- Background: clean, consistent across all panels
- ALL TEXT MUST BE IN ITALIAN
- Instructions must be concise and action-oriented
- Visual style: clean, modern, easy to follow at a glance`,

  social_proof: `CATEGORY: Social Proof
VISUAL RULES:
- Layout resembling a customer review or testimonial card
- Include: star rating (4-5 stars), reviewer name (realistic Italian name), review text
- Review text in Italian (max 20 words), natural and believable
- Visual style: clean card design, trustworthy and professional
- Optional: small reviewer avatar/photo placeholder
- Background: white or light, with subtle card shadow
- The product should be visible in the composition
- Include "Acquirente Verificato" badge if appropriate
- ALL TEXT MUST BE IN ITALIAN
- Tone: authentic, specific, mentioning a real benefit
- No fake-looking or overly enthusiastic language`,
};

// ─── Global Rules (apply to ALL categories) ─────────────────────

const GLOBAL_RULES = `GLOBAL NON-NEGOTIABLE RULES:
- Output: a single high-quality image, square 1:1 aspect ratio
- Use the uploaded product image as EXACT reference
- Do NOT change the product's shape, proportions, logo, label, colors, or materials
- No rebranding whatsoever
- Remove original background if needed and replace appropriately for the category
- Keep all product labels fully legible
- No deformation of the product
- No watermarks
- No random or placeholder text — all text must be real and meaningful
- No extra objects that are incoherent with the product or scene
- Image must be sharp, clean, and optimized for e-commerce

LANGUAGE RULES (MANDATORY):
- ALL text generated in images must be in Italian
- Headlines, subheadlines, benefits, steps, reviews, disclaimers — everything in correct, natural Italian
- If the product packaging has English text: translate and rephrase into correct Italian
- Do NOT keep English text unless it's part of the official brand name
- Tone must feel natural for the Italian market

TEXT LIMITS (when text is required):
- Headline: max 6 words
- Subheadline: max 14 words
- Benefit: max 5 words
- Review: max 20 words
- Step instruction: max 6 words

COPY LOGIC (when text is required):
1. Analyze the product packaging first
2. If readable text exists on packaging: reuse it, rephrased in Italian
3. If insufficient: generate coherent copy matching the category and product
4. Do NOT invent medical claims, certifications, or specific numbers
5. Maintain realistic, believable tone`;

/**
 * Build the complete prompt for image generation
 */
function buildImagePrompt(input: ImageGenerationInput): string {
  const categoryPrompt = CATEGORY_PROMPTS[input.category];
  const lang = input.language === "en" ? "English" : "Italian";

  return `You are an Ecommerce Visual Art Director specialized in creating high-conversion images for landing pages and Shopify stores.

TASK: Generate a professional e-commerce image for the following product.

PRODUCT INFO:
- Name: ${input.productName}
${input.productDescription ? `- Description: ${input.productDescription}` : ""}
- Language for all text: ${lang}

${categoryPrompt}

${GLOBAL_RULES}

The uploaded image is the REFERENCE product photo. Use it as the exact basis for generating the final image. Generate the image now.`;
}

/**
 * Determine if a category requires text in the generated image
 */
export function categoryRequiresText(category: ImageCategory): boolean {
  return category !== "product_photo";
}

/**
 * Generate an e-commerce image using Gemini Flash via OpenRouter.
 */
export async function generateImage(
  input: ImageGenerationInput
): Promise<GeneratedImage> {
  const apiKey = getApiKey();
  const model = getImageModel();
  const prompt = buildImagePrompt(input);

  // Build the multimodal message with product image + text prompt
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: prompt,
        },
        {
          type: "image_url" as const,
          image_url: {
            url: `data:${input.productImageMimeType};base64,${input.productImageBase64}`,
          },
        },
      ],
    },
  ];

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://theme-builder.shopify.app",
      "X-Title": "Shopify Theme Builder",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      // Required for Gemini image generation — tells the model to output images
      modalities: ["text", "image"],
      // Provider-specific: Gemini needs response_modalities
      provider: {
        require: ["modalities"],
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter Image API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  // Extract image from response — handle multiple possible formats
  const choice = data.choices?.[0]?.message;

  // Debug: log full response
  console.log("[ImageGen] Full API response:", JSON.stringify(data).substring(0, 3000));

  if (!choice) {
    throw new Error("No response from image generation model. Full response: " + JSON.stringify(data).substring(0, 500));
  }

  // Handle null/empty content — model refused or failed to generate
  if (choice.content === null || choice.content === undefined) {
    const finishReason = data.choices?.[0]?.finish_reason || "unknown";
    throw new Error(
      `Image model returned empty content (finish_reason: ${finishReason}). ` +
      `The model may not support this request format. ` +
      `Full response: ${JSON.stringify(data).substring(0, 500)}`
    );
  }

  // Helper to extract image from any content structure
  function extractImageFromParts(parts: any[]): GeneratedImage | null {
    for (const part of parts) {
      // OpenRouter multimodal: { type: "image_url", image_url: { url: "data:..." } }
      if (part.type === "image_url" && part.image_url?.url) {
        const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          return { imageBase64: match[2], mimeType: match[1], category: input.category };
        }
      }
      // Gemini inline_data: { inline_data: { data: "...", mime_type: "..." } }
      if (part.inline_data?.data) {
        return {
          imageBase64: part.inline_data.data,
          mimeType: part.inline_data.mime_type || "image/png",
          category: input.category,
        };
      }
      // Gemini native parts format: { data: "...", mimeType: "..." }
      if (part.data && part.mimeType?.startsWith("image/")) {
        return { imageBase64: part.data, mimeType: part.mimeType, category: input.category };
      }
    }
    return null;
  }

  // Format 1: content is an array of parts
  if (Array.isArray(choice.content)) {
    const result = extractImageFromParts(choice.content);
    if (result) return result;
  }

  // Format 2: content is an object (not array) — might have .parts or other structure
  if (choice.content && typeof choice.content === "object" && !Array.isArray(choice.content)) {
    // Gemini native: { parts: [...] }
    if (Array.isArray(choice.content.parts)) {
      const result = extractImageFromParts(choice.content.parts);
      if (result) return result;
    }
    // Direct inline_data on content object
    if (choice.content.inline_data?.data) {
      return {
        imageBase64: choice.content.inline_data.data,
        mimeType: choice.content.inline_data.mime_type || "image/png",
        category: input.category,
      };
    }
    // Try iterating all values looking for image data
    for (const value of Object.values(choice.content)) {
      if (Array.isArray(value)) {
        const result = extractImageFromParts(value);
        if (result) return result;
      }
    }
  }

  // Format 3: content is a string — might contain base64 or a URL
  if (typeof choice.content === "string") {
    const dataUrlMatch = choice.content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
    if (dataUrlMatch) {
      return {
        imageBase64: dataUrlMatch[2],
        mimeType: `image/${dataUrlMatch[1]}`,
        category: input.category,
      };
    }
  }

  throw new Error(
    "Could not extract generated image from model response. " +
    "Response format may have changed. Raw content type: " +
    typeof choice.content +
    ". Structure: " + JSON.stringify(choice.content).substring(0, 500)
  );
}

/**
 * Generate multiple images for different sections of the landing page.
 * Convenience wrapper that generates images in sequence with rate limiting.
 */
export async function generateImageSet(
  baseInput: Omit<ImageGenerationInput, "category">,
  categories: ImageCategory[],
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];

  for (let i = 0; i < categories.length; i++) {
    const image = await generateImage({
      ...baseInput,
      category: categories[i],
    });
    results.push(image);
    onProgress?.(i + 1, categories.length);

    // Rate limit: wait between generations (80 RPM = ~750ms between requests)
    if (i < categories.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
