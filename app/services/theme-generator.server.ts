import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { MerchantConfig, ThemeFile } from "~/types";
import { readMasterThemeFiles, readMasterThemeFile } from "./master-theme.server";
import {
  buildProductTemplate,
  buildHomepageTemplate,
  buildSettingsData,
} from "./template-builder.server";
import { createAndUploadTheme } from "./shopify-theme-api.server";
import db from "~/db.server";

/**
 * Main orchestrator for theme generation.
 *
 * Flow:
 * 1. Read all master theme files from disk
 * 2. Generate custom product template JSON from merchant config
 * 3. Generate custom homepage template JSON from merchant config
 * 4. Patch settings_data.json with merchant branding
 * 5. Assemble all files into a complete theme
 * 6. Upload to Shopify via Theme API
 */

export interface GenerationResult {
  themeId: number;
  previewUrl: string;
  filesUploaded: number;
}

export async function generateTheme(
  admin: AdminApiContext,
  shop: string,
  config: MerchantConfig,
  jobId?: string
): Promise<GenerationResult> {
  // Update job status
  if (jobId) {
    await updateJobStatus(jobId, "generating");
  }

  try {
    // Step 1: Read all master theme files
    const masterFiles = readMasterThemeFiles();

    // Step 2: Build custom templates
    const productTemplate = buildProductTemplate(config);
    const homepageTemplate = buildHomepageTemplate(config);

    // Step 3: Patch settings_data.json
    const originalSettings = readMasterThemeFile("config/settings_data.json");
    let settingsData: any = {};
    if (originalSettings) {
      settingsData = buildSettingsData(
        config,
        JSON.parse(originalSettings)
      );
    }

    // Step 4: Assemble the final file list
    const finalFiles = assembleFinalFiles(
      masterFiles,
      productTemplate,
      homepageTemplate,
      settingsData
    );

    // Update job status
    if (jobId) {
      await updateJobStatus(jobId, "uploading");
    }

    // Step 5: Upload to Shopify
    const themeName = `${config.brandName} - Generated Theme`;
    const result = await createAndUploadTheme(
      admin,
      themeName,
      finalFiles,
      (stage, progress) => {
        console.log(`[ThemeGenerator] ${stage}: ${progress}%`);
      }
    );

    // Update job as completed
    if (jobId) {
      await db.generatedTheme.update({
        where: { id: jobId },
        data: {
          status: "completed",
          shopifyThemeId: BigInt(result.themeId),
        },
      });
    }

    return {
      themeId: result.themeId,
      previewUrl: result.previewUrl,
      filesUploaded: finalFiles.length,
    };
  } catch (error: any) {
    if (jobId) {
      await db.generatedTheme.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: error.message || "Unknown error",
        },
      });
    }
    throw error;
  }
}

/**
 * Assemble the final list of theme files:
 * - Start with all master theme files
 * - Replace/add the generated product template
 * - Replace/add the generated homepage template
 * - Replace settings_data.json with patched version
 */
function assembleFinalFiles(
  masterFiles: ThemeFile[],
  productTemplate: object,
  homepageTemplate: object,
  settingsData: any
): ThemeFile[] {
  // Convert master files to a map for easy replacement
  const fileMap = new Map<string, ThemeFile>();
  for (const file of masterFiles) {
    fileMap.set(file.key, file);
  }

  // Replace the default product template with our generated landing page
  fileMap.set("templates/product.json", {
    key: "templates/product.json",
    value: JSON.stringify(productTemplate, null, 2),
  });

  // Replace homepage template
  fileMap.set("templates/index.json", {
    key: "templates/index.json",
    value: JSON.stringify(homepageTemplate, null, 2),
  });

  // Replace settings_data.json
  if (Object.keys(settingsData).length > 0) {
    fileMap.set("config/settings_data.json", {
      key: "config/settings_data.json",
      value: JSON.stringify(settingsData, null, 2),
    });
  }

  // Remove template files that belong to the original store
  // (keep only standard templates + our generated ones)
  const templatesToRemove = [
    "templates/product.basic-description.json",
    "templates/product.code-playbook.json",
    "templates/product.context.eu.json",
    "templates/product.context.it.json",
    "templates/product.landing-page-1.json",
    "templates/product.pagepilot-1772317636218-467613.json",
    "templates/product.quantity-breaks.json",
    "templates/product.static-ads.json",
    "templates/product.landing.json",
    "templates/index.context.it.json",
    "templates/blog.context.b2b.json",
  ];
  for (const key of templatesToRemove) {
    fileMap.delete(key);
  }

  return Array.from(fileMap.values());
}

/**
 * Create a new generation job in the database
 */
export async function createGenerationJob(
  shop: string,
  config: MerchantConfig
): Promise<string> {
  const job = await db.generatedTheme.create({
    data: {
      shop,
      themeName: `${config.brandName} - Generated Theme`,
      config: JSON.stringify(config),
      status: "pending",
    },
  });
  return job.id;
}

/**
 * Get generation job status
 */
export async function getGenerationJob(jobId: string) {
  return db.generatedTheme.findUnique({ where: { id: jobId } });
}

/**
 * Update job status
 */
async function updateJobStatus(
  jobId: string,
  status: string,
  error?: string
) {
  await db.generatedTheme.update({
    where: { id: jobId },
    data: { status, error },
  });
}

/**
 * Get default merchant config with placeholder values.
 * This serves as the starting point for the wizard.
 */
export function getDefaultConfig(): MerchantConfig {
  return {
    brandName: "",
    logoUrl: "",
    missionText: "",
    colors: {
      primary: "#000000",
      heading: "#000000",
      body: "#333333",
      buttonBg: "#000000",
      buttonText: "#ffffff",
      borderColor: "#ffe7ec",
    },
    product: {
      title: "",
      subtitle: "",
      description: "",
      benefits: [
        { emoji: "✅", text: "" },
        { emoji: "✅", text: "" },
        { emoji: "✅", text: "" },
        { emoji: "✅", text: "" },
      ],
      features: [
        { icon: "⚡", title: "", description: "" },
        { icon: "🧽", title: "", description: "" },
        { icon: "🌡️", title: "", description: "" },
        { icon: "🏋️", title: "", description: "" },
      ],
      images: [],
      lifestyleImages: [],
    },
    reviews: [],
    reviewRating: 4.8,
    reviewCount: 152,
    faqs: [
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" },
    ],
    cta: {
      mainButtonText: "Add to Cart",
      guaranteeTitle: "",
      guaranteeDescription: "",
      guaranteeIcon: "certification",
    },
    guarantees: {
      text1: "Spedizione veloce",
      icon1: "truck",
      text2: "Resi gratuiti",
      icon2: "box",
      text3: "Garanzia di 30 giorni",
      icon3: "heart",
    },
    comparison: {
      productTitle: "Il Nostro Prodotto",
      competitorTitle: "Altri",
      heading: "",
      description: "",
      items: [],
    },
    percentages: {
      heading: "",
      stats: [],
    },
    imageTextSections: [],
    homepage: {
      heroImageUrl: "",
      collectionHandle: "frontpage",
      whyChooseUs: {
        heading: "Perché sceglierci",
        points: [
          { title: "Assistenza clienti", description: "" },
          { title: "Reso facile e veloce", description: "" },
          { title: "Spedizione veloce", description: "" },
        ],
      },
    },
  };
}
