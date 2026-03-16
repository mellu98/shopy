import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { ThemeFile } from "~/types";

/**
 * Creates a new theme and uploads all files via the Shopify Admin API.
 */

interface CreateThemeResult {
  themeId: number;
  previewUrl: string;
}

/**
 * Create a new unpublished theme on the merchant's store
 */
export async function createTheme(
  admin: AdminApiContext,
  name: string
): Promise<number> {
  const response = await admin.rest.post({
    path: "themes",
    data: {
      theme: {
        name,
        role: "unpublished", // Don't publish immediately
      },
    },
  });

  const body = await response.json();
  if (!body.theme?.id) {
    throw new Error(`Failed to create theme: ${JSON.stringify(body)}`);
  }

  return body.theme.id;
}

/**
 * Upload a single asset to a theme.
 * Handles both text and binary (base64) files.
 */
export async function uploadAsset(
  admin: AdminApiContext,
  themeId: number,
  file: ThemeFile
): Promise<void> {
  const isBase64 = file.value.startsWith("__BASE64__");

  const assetData: Record<string, string> = {
    key: file.key,
  };

  if (isBase64) {
    assetData.attachment = file.value.replace("__BASE64__", "");
  } else {
    assetData.value = file.value;
  }

  await admin.rest.put({
    path: `themes/${themeId}/assets`,
    data: { asset: assetData },
  });
}

/**
 * Files that Shopify's Asset API rejects (422).
 * Section groups and context-specific overrides must be excluded.
 */
function shouldSkipFile(key: string): boolean {
  // Section group files: sections/*-group.json, sections/*-group.context.*.json
  if (key.startsWith("sections/") && key.includes("-group")) return true;
  // Context-specific template/section overrides: *.context.*.json
  if (key.includes(".context.") && key.endsWith(".json")) return true;
  return false;
}

/**
 * Upload all theme files with rate limiting.
 * Shopify allows ~2 requests/second for asset uploads.
 * Upload failures are non-fatal: failed files are logged and skipped
 * so the theme generation process always completes.
 */
export async function uploadAllAssets(
  admin: AdminApiContext,
  themeId: number,
  files: ThemeFile[],
  onProgress?: (uploaded: number, total: number) => void
): Promise<{ uploaded: number; skipped: string[] }> {
  const BATCH_SIZE = 2;
  const DELAY_MS = 600;
  const skipped: string[] = [];

  // Filter out files that Shopify's Asset API doesn't accept
  const filtered = files.filter((f) => {
    if (shouldSkipFile(f.key)) {
      skipped.push(f.key);
      return false;
    }
    return true;
  });
  if (skipped.length > 0) {
    console.log(`[ThemeUpload] Pre-filtered ${skipped.length} unsupported files`);
  }
  files = filtered;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map((file) =>
        uploadAsset(admin, themeId, file).catch((err) => {
          console.warn(`[ThemeUpload] Failed to upload ${file.key} — skipping. Error:`, err?.status || err?.message || err);
          skipped.push(file.key);
          // Never throw — continue uploading remaining files
        })
      )
    );

    onProgress?.(Math.min(i + BATCH_SIZE, files.length), files.length);

    if (i + BATCH_SIZE < files.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  if (skipped.length > 0) {
    console.warn(`[ThemeUpload] Completed with ${skipped.length} skipped files:`, skipped);
  }

  return { uploaded: files.length - skipped.length, skipped };
}

/**
 * Get the preview URL for an unpublished theme
 */
export async function getThemePreviewUrl(
  admin: AdminApiContext,
  themeId: number
): Promise<string> {
  const response = await admin.rest.get({
    path: `themes/${themeId}`,
  });

  const body = await response.json();
  return body.theme?.preview_url || "";
}

/**
 * Full theme creation + upload flow
 */
export async function createAndUploadTheme(
  admin: AdminApiContext,
  themeName: string,
  files: ThemeFile[],
  onProgress?: (stage: string, progress: number) => void
): Promise<CreateThemeResult> {
  onProgress?.("creating", 0);

  // Step 1: Create the theme
  const themeId = await createTheme(admin, themeName);
  onProgress?.("uploading", 0);

  // Step 2: Upload all files
  await uploadAllAssets(admin, themeId, files, (uploaded, total) => {
    const progress = Math.round((uploaded / total) * 100);
    onProgress?.("uploading", progress);
  });

  // Step 3: Get preview URL
  onProgress?.("finalizing", 100);
  const previewUrl = await getThemePreviewUrl(admin, themeId);

  return { themeId, previewUrl };
}

/**
 * List existing themes on the store
 */
export async function listThemes(
  admin: AdminApiContext
): Promise<Array<{ id: number; name: string; role: string }>> {
  const response = await admin.rest.get({ path: "themes" });
  const body = await response.json();
  return body.themes || [];
}
