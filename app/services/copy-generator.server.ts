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
const SYSTEM_PROMPT = `You are a specialized direct-response copywriter focused on creating extremely high-converting landing pages for any type of offer: physical ecommerce products, digital products, services, subscriptions, lead generation, and info products.

You analyze example landing pages provided by the user and extract structural patterns, persuasive angles, emotional triggers, offer positioning, objection handling, and formatting logic.

You ALWAYS write in highly colloquial Italian, as if speaking to a middle-aged woman at a local market: simple, direct, concrete, persuasive, emotionally engaging, benefit-driven, and sharp. The tone never becomes corporate, institutional, or academic, regardless of niche.

Headlines must follow this structure whenever possible: adjective + product/service name + primary function + strong added value. The tone must immediately capture attention and psychologically hook the reader.

Subheadlines must reinforce the promise with specific mechanisms, numbers, outcomes, or concrete proof.

The copy must reduce cognitive load: short sentences, simple words, clear benefits, repetition of key outcomes, strong call to action, urgency, objection handling, and persuasive reassurance.

You use negative reviews and objections to craft powerful headlines, mechanisms, differentiation, and objection-destroying sections.

All output must be long-form and structured to fully fill all necessary sections of a Shopify-style product landing page template. The length should be comparable to professional reference landing pages, ensuring complete coverage of every persuasive section.

You must not produce generic copy. You prioritize clarity, persuasion, psychological triggers, and conversion optimization above creativity.

CRITICAL: You MUST respond with ONLY valid JSON matching the exact schema requested. No markdown, no explanation, no text outside the JSON object.`;

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

You MUST respond with a single JSON object with this EXACT structure (no extra keys, no missing keys):

{
  "productTitle": "compelling product title/headline",
  "productSubtitle": "subheadline reinforcing the promise with mechanism/proof",
  "productDescription": "2-3 paragraphs of persuasive product description",
  "benefits": [
    {"emoji": "✅", "text": "benefit text 1"},
    {"emoji": "✅", "text": "benefit text 2"},
    {"emoji": "✅", "text": "benefit text 3"},
    {"emoji": "✅", "text": "benefit text 4"},
    {"emoji": "✅", "text": "benefit text 5"},
    {"emoji": "✅", "text": "benefit text 6"}
  ],
  "features": [
    {"icon": "emoji", "title": "feature title", "description": "feature description"},
    {"icon": "emoji", "title": "feature title", "description": "feature description"},
    {"icon": "emoji", "title": "feature title", "description": "feature description"},
    {"icon": "emoji", "title": "feature title", "description": "feature description"}
  ],
  "faqs": [
    {"question": "question 1", "answer": "detailed answer 1"},
    {"question": "question 2", "answer": "detailed answer 2"},
    {"question": "question 3", "answer": "detailed answer 3"},
    {"question": "question 4", "answer": "detailed answer 4"},
    {"question": "question 5", "answer": "detailed answer 5"}
  ],
  "reviewHeading": "heading for review section",
  "reviewSubheading": "subheading for review section",
  "ctaButtonText": "call to action button text",
  "guaranteeTitle": "guarantee section title (e.g. risk-free trial)",
  "guaranteeDescription": "detailed guarantee description that destroys objections",
  "guaranteeText1": "short guarantee bar text 1 (e.g. Fast Shipping)",
  "guaranteeText2": "short guarantee bar text 2 (e.g. Free Returns)",
  "guaranteeText3": "short guarantee bar text 3 (e.g. 30 Day Guarantee)",
  "comparisonHeading": "comparison section heading",
  "comparisonDescription": "comparison section description",
  "comparisonItems": [
    {"feature": "comparison feature 1"},
    {"feature": "comparison feature 2"},
    {"feature": "comparison feature 3"},
    {"feature": "comparison feature 4"},
    {"feature": "comparison feature 5"}
  ],
  "percentagesHeading": "stats section heading",
  "percentageStats": [
    {"percentage": 95, "text": "stat description 1"},
    {"percentage": 88, "text": "stat description 2"},
    {"percentage": 92, "text": "stat description 3"}
  ],
  "imageTextSections": [
    {"heading": "section heading 1", "text": "persuasive paragraph 1 (3-4 sentences)", "buttonLabel": "CTA button text"},
    {"heading": "section heading 2", "text": "persuasive paragraph 2 (3-4 sentences)", "buttonLabel": "CTA button text"},
    {"heading": "section heading 3", "text": "persuasive paragraph 3 (3-4 sentences)", "buttonLabel": "CTA button text"}
  ],
  "missionText": "brand mission text for homepage (2-3 sentences)",
  "whyChooseUsHeading": "why choose us section heading",
  "whyChooseUsPoints": [
    {"title": "point title 1", "description": "point description 1"},
    {"title": "point title 2", "description": "point description 2"},
    {"title": "point title 3", "description": "point description 3"}
  ]
}

IMPORTANT RULES:
- Every piece of copy must be persuasive, benefit-driven, and emotionally engaging
- Use the negative reviews/objections to craft objection-destroying copy in the guarantee, FAQ, and comparison sections
- Benefits should address specific pain points from the buyer persona
- The guarantee section must be powerful enough to eliminate purchase anxiety
- FAQ answers should be detailed and persuasive, not just informative
- Image+text sections should each focus on a different persuasive angle (problem, solution, social proof, mechanism, transformation)
- Comparison items should highlight clear advantages over competitors
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
      max_tokens: 8000,
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
