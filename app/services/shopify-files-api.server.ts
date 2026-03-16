import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { ImageCategory } from "~/types";

/**
 * Upload images to Shopify Files via GraphQL.
 * Returns shopify://shop_images/ references usable in image_picker fields.
 *
 * Flow:
 * 1. stagedUploadsCreate → get pre-signed upload URL
 * 2. HTTP POST the file to staged URL
 * 3. fileCreate → Shopify processes the upload
 * 4. Return shopify://shop_images/filename reference
 */

interface UploadedImage {
  category: ImageCategory;
  shopifyUrl: string; // shopify://shop_images/filename.jpg
  cdnUrl: string;     // https://cdn.shopify.com/...
}

interface ImageToUpload {
  category: ImageCategory;
  base64: string;
  mimeType: string;
}

/**
 * Upload a single image to Shopify Files via GraphQL.
 */
async function uploadSingleImage(
  admin: AdminApiContext,
  image: ImageToUpload,
  index: number
): Promise<UploadedImage> {
  console.log(`[ShopifyFiles] uploadSingleImage: category=${image.category}, base64Length=${image.base64?.length || 0}, mimeType=${image.mimeType}`);
  const ext = image.mimeType === "image/png" ? "png" : "jpg";
  const filename = `generated-${image.category}-${index}-${Date.now()}.${ext}`;

  // Step 1: Create staged upload target
  console.log(`[ShopifyFiles] Step 1: Creating staged upload for ${filename}...`);
  let stagedResponse;
  try {
    stagedResponse = await admin.graphql(
      `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: [
            {
              filename,
              mimeType: image.mimeType,
              httpMethod: "POST",
              resource: "FILE",
            },
          ],
        },
      }
    );
  } catch (gqlErr: any) {
    // admin.graphql() throws a Response object on HTTP errors (e.g., missing scope)
    let errDetail = String(gqlErr);
    if (gqlErr && typeof gqlErr.text === "function") {
      try { errDetail = await gqlErr.text(); } catch {}
    } else if (gqlErr?.message) {
      errDetail = gqlErr.message;
    }
    throw new Error(`GraphQL stagedUploadsCreate failed: ${errDetail.substring(0, 500)}`);
  }

  const stagedData = await stagedResponse.json();
  const stagedTarget = stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];
  const userErrors = stagedData.data?.stagedUploadsCreate?.userErrors;

  if (userErrors?.length > 0) {
    throw new Error(
      `Staged upload error: ${userErrors.map((e: any) => e.message).join(", ")}`
    );
  }
  if (!stagedTarget) {
    throw new Error(
      `Failed to create staged upload. Response: ${JSON.stringify(stagedData).substring(0, 500)}`
    );
  }

  // Step 2: Upload the file to the staged URL
  const binaryData = Buffer.from(image.base64, "base64");
  const formData = new FormData();

  // Add all parameters from the staged target
  for (const param of stagedTarget.parameters) {
    formData.append(param.name, param.value);
  }

  // Add the file itself
  const blob = new Blob([binaryData], { type: image.mimeType });
  formData.append("file", blob, filename);

  const uploadResponse = await fetch(stagedTarget.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text().catch(() => "unknown");
    throw new Error(
      `File upload to staged URL failed (${uploadResponse.status}): ${errText.substring(0, 300)}`
    );
  }

  // Step 3: Create the file in Shopify
  let fileCreateResponse;
  try {
    fileCreateResponse = await admin.graphql(
      `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            alt
            createdAt
            ... on MediaImage {
              image {
                url
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          files: [
            {
              alt: `Generated ${image.category} image`,
              contentType: "IMAGE",
              originalSource: stagedTarget.resourceUrl,
            },
          ],
        },
      }
    );
  } catch (gqlErr: any) {
    let errDetail = String(gqlErr);
    if (gqlErr && typeof gqlErr.text === "function") {
      try { errDetail = await gqlErr.text(); } catch {}
    } else if (gqlErr?.message) {
      errDetail = gqlErr.message;
    }
    throw new Error(`GraphQL fileCreate failed: ${errDetail.substring(0, 500)}`);
  }

  const fileData = await fileCreateResponse.json();
  const fileErrors = fileData.data?.fileCreate?.userErrors;

  if (fileErrors?.length > 0) {
    throw new Error(
      `File create error: ${fileErrors.map((e: any) => e.message).join(", ")}`
    );
  }

  const createdFile = fileData.data?.fileCreate?.files?.[0];
  if (!createdFile) {
    throw new Error(
      `Failed to create file. Response: ${JSON.stringify(fileData).substring(0, 500)}`
    );
  }

  // The shopify://shop_images/ reference uses the filename
  const shopifyUrl = `shopify://shop_images/${filename}`;
  const cdnUrl = createdFile.image?.url || "";

  console.log(`[ShopifyFiles] Uploaded ${image.category} → ${shopifyUrl}`);

  return {
    category: image.category,
    shopifyUrl,
    cdnUrl,
  };
}

/**
 * Upload all generated images to Shopify Files.
 * Returns a map of category → shopify://shop_images/ URL.
 */
export async function uploadImagesToShopify(
  admin: AdminApiContext,
  images: ImageToUpload[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<ImageCategory, string>> {
  const urlMap = new Map<ImageCategory, string>();

  for (let i = 0; i < images.length; i++) {
    try {
      const result = await uploadSingleImage(admin, images[i], i);
      urlMap.set(result.category, result.shopifyUrl);
      onProgress?.(i + 1, images.length);
    } catch (err: any) {
      console.warn(
        `[ShopifyFiles] Failed to upload ${images[i].category}: ${err?.message || err}`,
        `| base64 length: ${images[i]?.base64?.length || 0}`,
        `| mimeType: ${images[i]?.mimeType}`
      );
      if (err?.response) {
        try { console.warn(`[ShopifyFiles] Response:`, JSON.stringify(await err.response.json()).substring(0, 500)); } catch {}
      }
      // Continue with other images — non-fatal
    }

    // Rate limit between uploads
    if (i < images.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return urlMap;
}

/**
 * Map uploaded image URLs to the correct MerchantConfig fields.
 * Returns a partial config update.
 */
export function mapImagesToConfig(
  urlMap: Map<ImageCategory, string>
): {
  heroImageUrl?: string;
  lifestyleImages: string[];
  imageTextImageUrls: string[];
} {
  return {
    heroImageUrl: urlMap.get("product_photo"),
    lifestyleImages: [
      urlMap.get("lifestyle") || "",
      urlMap.get("social_proof") || "",
    ].filter(Boolean),
    imageTextImageUrls: [
      urlMap.get("ingredients") || "",
      urlMap.get("infographic") || "",
      urlMap.get("how_to_process") || "",
    ].filter(Boolean),
  };
}
