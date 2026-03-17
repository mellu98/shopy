import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { MerchantConfig, ThemeFile, ImageCategory } from "~/types";
import { readMasterThemeFiles, readMasterThemeFile } from "./master-theme.server";
import {
  buildProductTemplate,
  buildSettingsData,
} from "./template-builder.server";
import { createAndUploadTheme } from "./shopify-theme-api.server";
import { uploadImagesToShopify } from "./shopify-files-api.server";
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
  jobId?: string,
  generatedImages?: Array<{ base64: string; mimeType: string; category: ImageCategory }>
): Promise<GenerationResult> {
  // Update job status
  if (jobId) {
    await updateJobStatus(jobId, "generating");
  }

  try {
    // Step 0: Upload generated images to Shopify Files (if any)
    if (generatedImages && generatedImages.length > 0) {
      console.log(`[ThemeGenerator] Uploading ${generatedImages.length} images to Shopify Files...`);
      try {
        const urlMap = await uploadImagesToShopify(
          admin,
          generatedImages.map((img) => ({
            category: img.category,
            base64: img.base64,
            mimeType: img.mimeType,
          })),
          (done, total) => {
            console.log(`[ThemeGenerator] Image upload: ${done}/${total}`);
          }
        );

        // Map uploaded image URLs to config fields
        const heroUrl = urlMap.get("product_photo");
        const lifestyleUrl = urlMap.get("lifestyle");
        const ingredientsUrl = urlMap.get("ingredients");
        const infographicUrl = urlMap.get("infographic");
        const howToUrl = urlMap.get("how_to_process");
        const socialProofUrl = urlMap.get("social_proof");

        // heroUrl no longer needed for homepage (master theme kept as-is)
        // lifestyleImages used in product landing page sections
        config.product.lifestyleImages = [
          lifestyleUrl || "",
          socialProofUrl || heroUrl || "",
        ].filter(Boolean);

        // Map to imageTextSections
        const imageUrls = [ingredientsUrl, infographicUrl, howToUrl].filter(Boolean) as string[];
        for (let i = 0; i < imageUrls.length && i < config.imageTextSections.length; i++) {
          config.imageTextSections[i].imageUrl = imageUrls[i];
        }

        console.log(`[ThemeGenerator] Successfully uploaded ${urlMap.size} images`);
      } catch (imgErr: any) {
        console.warn(`[ThemeGenerator] Image upload failed (non-fatal): ${imgErr.message}`);
        // Continue without images — theme still works, just no custom images
      }
    }

    // Step 1: Read all master theme files
    const masterFiles = readMasterThemeFiles();

    // Step 2: Build custom templates (homepage uses master theme as-is)
    const productTemplate = buildProductTemplate(config);

    // Step 3: Patch settings_data.json
    const originalSettings = readMasterThemeFile("config/settings_data.json");
    let settingsData: any = {};
    if (originalSettings) {
      settingsData = buildSettingsData(
        config,
        JSON.parse(originalSettings)
      );
    }

    // Step 4: Assemble the final file list (homepage kept from master theme)
    const finalFiles = assembleFinalFiles(
      masterFiles,
      productTemplate,
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
 * - Start with all master theme files (homepage kept as-is from master)
 * - Replace/add the generated product template
 * - Replace settings_data.json with patched version
 */
function assembleFinalFiles(
  masterFiles: ThemeFile[],
  productTemplate: object,
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

  // Homepage (templates/index.json) is NOT replaced — master theme's
  // generic homepage with its own images and copy is kept as-is.

  // Replace settings_data.json
  if (Object.keys(settingsData).length > 0) {
    fileMap.set("config/settings_data.json", {
      key: "config/settings_data.json",
      value: JSON.stringify(settingsData, null, 2),
    });
  }

  // Patch theme.liquid:
  // 1. Replace section groups with direct section references (groups can't be uploaded via Asset API)
  // 2. Add pagepilot-styles.css globally (it's only loaded on product pages by default)
  const themeLayout = fileMap.get("layout/theme.liquid");
  if (themeLayout) {
    let layoutContent = themeLayout.value;
    // Replace section groups with direct references
    layoutContent = layoutContent.replace(
      "{% sections 'header-group' %}",
      "{% section 'header' %}"
    );
    layoutContent = layoutContent.replace(
      "{% sections 'footer-group' %}",
      "{% section 'footer' %}"
    );
    layoutContent = layoutContent.replace(
      "{% sections 'popup-group' %}",
      ""
    );
    // Inject pagepilot CSS globally (needed for PP sections on homepage/other pages)
    layoutContent = layoutContent.replace(
      "{{ content_for_header }}",
      "{{ content_for_header }}\n    {{ 'pagepilot-styles.css' | asset_url | stylesheet_tag }}"
    );
    fileMap.set("layout/theme.liquid", {
      key: "layout/theme.liquid",
      value: layoutContent,
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
