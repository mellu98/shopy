import type { CopyGenerationInput, GeneratedCopy } from "~/types";

/**
 * AI Copy Generator — calls Claude via OpenRouter with the
 * "Signora Market Copy" system prompt to generate persuasive,
 * high-converting copy for all theme sections.
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }
  return key;
}

function getModel(): string {
  return process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";
}

/**
 * System prompt: "Signora Market Copy" — direct-response copywriter
 * specialized in high-converting landing pages.
 */
const SYSTEM_PROMPT = `You are a specialized direct-response copywriter focused on creating high-converting landing pages for any type of offer: physical ecommerce products, digital products, services, subscriptions, lead generation, and info products.

You ALWAYS write in highly colloquial Italian, as if speaking to a middle-aged woman at a local market: simple, direct, concrete, persuasive, emotionally engaging, benefit-driven, and sharp. The tone never becomes corporate, institutional, or academic, regardless of niche.

CRITICAL RULE — CONCISENESS: Every piece of copy must be SHORT, PUNCHY, and SCANNABLE. E-commerce shoppers do NOT read long text. Follow these principles:
- Headlines: 3-6 words max. Hook immediately.
- Descriptions: 1-2 short sentences max. Never a full paragraph.
- Benefits: one punchy line each, under 45 characters.
- FAQ answers: 1-2 sentences max. Direct and reassuring.
- Never use filler words, corporate jargon, or unnecessary adjectives.
- If you can say it in 5 words, don't use 15.

Headlines must follow this structure whenever possible: adjective + product/service name + primary function + strong added value. The tone must immediately capture attention and psychologically hook the reader.

The copy must reduce cognitive load: short sentences, simple words, clear benefits, strong call to action.

You use negative reviews and objections to craft powerful headlines and objection-destroying copy.

You must not produce generic copy. You prioritize clarity, persuasion, and conversion optimization above creativity.

USP VARIETY RULE (NON-NEGOTIABLE):
Each section of the landing page MUST highlight a DIFFERENT benefit, angle, or concept. NEVER repeat the same USP, keyword, or phrase across multiple sections. If the product's main hook is a specific claim (e.g., "in 3 secondi"), use it ONCE in the hero — then move on.
Map sections to different angles:
- productTitle + productSubtitle: PRIMARY USP (the #1 hook — use the strongest claim here and ONLY here)
- benefits: 6 DIFFERENT micro-benefits, each a unique angle (speed, convenience, cleanliness, portability, durability, design, etc.)
- imageTextSections[0]: PROBLEM/PAIN POINT the product solves (focus on the frustration, not the solution)
- imageTextSections[1]: UNIQUE MECHANISM / how it works (explain the technology or method)
- imageTextSections[2]: SOCIAL PROOF angle (trust, popularity, satisfaction)
- comparisonHeading + items: COMPETITIVE ADVANTAGES vs alternatives (what competitors lack)
- percentagesHeading + stats: SATISFACTION / RESULTS data (different metrics, not reworded versions of the same stat)
- faqs: ADDRESS OBJECTIONS from negative reviews (each FAQ = a different objection)
If you catch yourself reusing the same word or concept in two sections, STOP and rewrite one of them with a fresh angle.

CRITICAL: You MUST respond with ONLY valid JSON matching the exact schema requested. No markdown, no explanation, no text outside the JSON object. RESPECT ALL CHARACTER LIMITS specified in the schema.`;

/**
 * Build the user prompt with all merchant input
 */
function buildUserPrompt(input: CopyGenerationInput): string {
  const lang = input.language === "en" ? "English" : "Italian";

  return `Generate ALL the copy for a Shopify product landing page and homepage.

PRODUCT INFORMATION:
- Product Name: ${input.productName}
- Brand: ${input.brandName}
- Niche: ${input.niche || "general ecommerce"}
- Description: ${input.productDescription}
${input.productUrl ? `- Product URL: ${input.productUrl}` : ""}

BUYER PERSONA:
${input.buyerPersona}

NEGATIVE REVIEWS / OBJECTIONS:
${input.negativeReviews}

LANGUAGE: Write ALL copy in ${lang}.

You MUST respond with a single JSON object with this EXACT structure (no extra keys, no missing keys).
⚠️ RESPECT THE MAX CHARACTER LIMITS — they are HARD limits. Count characters before writing.

{
  "productTitle": "MAX 40 CHARS — punchy product headline, 3-6 words",
  "productSubtitle": "MAX 80 CHARS — one short sentence reinforcing the promise",
  "productDescription": "MAX 150 CHARS — one concise paragraph, benefit-driven",
  "benefits": [
    {"emoji": "✅", "text": "MAX 45 CHARS — one punchy benefit line"},
    {"emoji": "✅", "text": "MAX 45 CHARS — one punchy benefit line"},
    {"emoji": "✅", "text": "MAX 45 CHARS — one punchy benefit line"},
    {"emoji": "✅", "text": "MAX 45 CHARS — one punchy benefit line"},
    {"emoji": "✅", "text": "MAX 45 CHARS — one punchy benefit line"},
    {"emoji": "✅", "text": "MAX 45 CHARS — one punchy benefit line"}
  ],
  "features": [
    {"icon": "emoji", "title": "MAX 25 CHARS — short feature name", "description": "MAX 80 CHARS — one sentence explaining the feature"},
    {"icon": "emoji", "title": "MAX 25 CHARS", "description": "MAX 80 CHARS"},
    {"icon": "emoji", "title": "MAX 25 CHARS", "description": "MAX 80 CHARS"},
    {"icon": "emoji", "title": "MAX 25 CHARS", "description": "MAX 80 CHARS"}
  ],
  "faqs": [
    {"question": "MAX 50 CHARS — short question", "answer": "MAX 120 CHARS — 1-2 sentences, direct and reassuring"},
    {"question": "MAX 50 CHARS", "answer": "MAX 120 CHARS"},
    {"question": "MAX 50 CHARS", "answer": "MAX 120 CHARS"},
    {"question": "MAX 50 CHARS", "answer": "MAX 120 CHARS"},
    {"question": "MAX 50 CHARS", "answer": "MAX 120 CHARS"}
  ],
  "reviewHeading": "MAX 35 CHARS — review section heading",
  "reviewSubheading": "MAX 60 CHARS — review section subheading",
  "ctaButtonText": "MAX 20 CHARS — action verb + object",
  "guaranteeTitle": "MAX 40 CHARS — guarantee headline",
  "guaranteeDescription": "MAX 120 CHARS — 1-2 sentences destroying objections",
  "guaranteeText1": "MAX 25 CHARS — e.g. Spedizione Veloce",
  "guaranteeText2": "MAX 25 CHARS — e.g. Resi Gratuiti",
  "guaranteeText3": "MAX 25 CHARS — e.g. Garanzia 30 Giorni",
  "comparisonHeading": "MAX 35 CHARS — comparison heading",
  "comparisonDescription": "MAX 130 CHARS — why your product wins, 1-2 sentences",
  "comparisonItems": [
    {"feature": "MAX 30 CHARS — short comparison point"},
    {"feature": "MAX 30 CHARS"},
    {"feature": "MAX 30 CHARS"},
    {"feature": "MAX 30 CHARS"},
    {"feature": "MAX 30 CHARS"}
  ],
  "percentagesHeading": "MAX 35 CHARS — stats section heading",
  "percentageStats": [
    {"percentage": 95, "text": "MAX 30 CHARS — short stat label"},
    {"percentage": 88, "text": "MAX 30 CHARS"},
    {"percentage": 92, "text": "MAX 30 CHARS"}
  ],
  "imageTextSections": [
    {"heading": "MAX 30 CHARS — section heading", "text": "MAX 140 CHARS — 1-2 sentences, one persuasive angle", "buttonLabel": "MAX 20 CHARS"},
    {"heading": "MAX 30 CHARS", "text": "MAX 140 CHARS", "buttonLabel": "MAX 20 CHARS"},
    {"heading": "MAX 30 CHARS", "text": "MAX 140 CHARS", "buttonLabel": "MAX 20 CHARS"}
  ],
  "missionText": "MAX 120 CHARS — 1-2 sentences about the brand mission",
  "whyChooseUsHeading": "MAX 30 CHARS — section heading",
  "whyChooseUsPoints": [
    {"title": "MAX 25 CHARS — point title", "description": "MAX 80 CHARS — one sentence"},
    {"title": "MAX 25 CHARS", "description": "MAX 80 CHARS"},
    {"title": "MAX 25 CHARS", "description": "MAX 80 CHARS"}
  ]
}

IMPORTANT RULES:
- ⚠️ CONCISENESS IS THE #1 PRIORITY. Short, punchy copy converts better than long text. Respect ALL character limits strictly.
- Use the negative reviews/objections to craft objection-destroying copy in guarantee, FAQ, and comparison sections
- Benefits should address specific pain points from the buyer persona
- Image+text sections: each focuses on ONE persuasive angle (problem, solution, social proof)
- ALL percentages must be realistic and believable
- Output ONLY the JSON object, nothing else`;
}

/**
 * Call Claude via OpenRouter and return the generated copy.
 */
export async function generateCopy(
  input: CopyGenerationInput
): Promise<GeneratedCopy> {
  const apiKey = getApiKey();
  const model = getModel();

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
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content returned from OpenRouter API");
  }

  // Parse JSON from the response — handle potential markdown wrapping
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: GeneratedCopy;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(
      `Failed to parse AI response as JSON: ${(e as Error).message}\nRaw response: ${content.substring(0, 500)}`
    );
  }

  return parsed;
}

/**
 * Apply generated copy to a MerchantConfig, filling in all text fields.
 * Preserves existing non-copy fields (colors, images, etc.)
 */
export function applyCopyToConfig(
  config: import("~/types").MerchantConfig,
  copy: GeneratedCopy
): import("~/types").MerchantConfig {
  return {
    ...config,
    missionText: copy.missionText,
    product: {
      ...config.product,
      title: copy.productTitle,
      subtitle: copy.productSubtitle,
      description: copy.productDescription,
      benefits: copy.benefits,
      features: copy.features,
    },
    faqs: copy.faqs,
    cta: {
      ...config.cta,
      mainButtonText: copy.ctaButtonText,
      guaranteeTitle: copy.guaranteeTitle,
      guaranteeDescription: copy.guaranteeDescription,
    },
    guarantees: {
      ...config.guarantees,
      text1: copy.guaranteeText1,
      text2: copy.guaranteeText2,
      text3: copy.guaranteeText3,
    },
    comparison: {
      ...config.comparison,
      heading: copy.comparisonHeading,
      description: copy.comparisonDescription,
      items: copy.comparisonItems.map((item) => ({
        feature: item.feature,
        productHas: true,
        competitorHas: false,
      })),
    },
    percentages: {
      heading: copy.percentagesHeading,
      stats: copy.percentageStats,
    },
    imageTextSections: copy.imageTextSections.map((sec, i) => ({
      heading: sec.heading,
      text: sec.text,
      buttonLabel: sec.buttonLabel,
      imageUrl: config.imageTextSections?.[i]?.imageUrl || "",
      layout: i % 2 === 0 ? ("image_first" as const) : ("text_first" as const),
    })),
    homepage: {
      ...config.homepage,
      whyChooseUs: {
        heading: copy.whyChooseUsHeading,
        points: copy.whyChooseUsPoints,
      },
    },
  };
}
