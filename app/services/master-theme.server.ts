import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";
import type { ThemeFile } from "~/types";

/**
 * Reads the master theme files from disk.
 * In development, reads from the parent directory (the actual theme).
 * In production, reads from bundled master-theme/ directory.
 */

const MASTER_THEME_PATH =
  process.env.MASTER_THEME_PATH ||
  join(process.cwd(), "..", ""); // Parent dir = the theme root

// Directories that make up a complete Shopify theme
const THEME_DIRS = [
  "assets",
  "config",
  "layout",
  "locales",
  "sections",
  "snippets",
  "templates",
];

// Binary file extensions (these need base64 encoding for Shopify Asset API)
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".ico", ".woff", ".woff2", ".ttf", ".eot",
]);

/**
 * Recursively collect all files in a directory
 */
function collectFiles(dir: string, base: string): ThemeFile[] {
  const files: ThemeFile[] = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else {
      const key = relative(base, fullPath).replace(/\\/g, "/");
      const ext = entry.substring(entry.lastIndexOf(".")).toLowerCase();

      if (BINARY_EXTENSIONS.has(ext)) {
        // For binary files, store base64-encoded content
        const content = readFileSync(fullPath).toString("base64");
        files.push({ key, value: `__BASE64__${content}` });
      } else {
        const content = readFileSync(fullPath, "utf-8");
        files.push({ key, value: content });
      }
    }
  }

  return files;
}

/**
 * Read all master theme files
 */
export function readMasterThemeFiles(): ThemeFile[] {
  const allFiles: ThemeFile[] = [];

  for (const dir of THEME_DIRS) {
    const dirPath = join(MASTER_THEME_PATH, dir);
    allFiles.push(...collectFiles(dirPath, MASTER_THEME_PATH));
  }

  return allFiles;
}

/**
 * Read a specific master theme file
 */
export function readMasterThemeFile(key: string): string | null {
  const fullPath = join(MASTER_THEME_PATH, key);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, "utf-8");
}

/**
 * Get the list of all master theme file keys (paths)
 */
export function getMasterThemeFileKeys(): string[] {
  return readMasterThemeFiles().map((f) => f.key);
}
