/**
 * Shared sharp plumbing for the image scripts (organize-images.js,
 * optimize-images.js). One converter, one logger, one dir helper, so the
 * two workflows cannot drift on quality or skip semantics.
 */

import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { extname } from "path";

/** Verbose logger gated on VERBOSE=1, matching the npm *:v conventions. */
export function makeLogger() {
  const verbose = !!process.env.VERBOSE;
  return (...args) => {
    if (verbose) console.debug(...args);
  };
}

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Convert one image. Output format follows the destination extension
 * (.webp, .jpg, .avif). Existing outputs are skipped so re-runs are
 * idempotent; set FORCE=1 to re-process. Returns true when a file was
 * written.
 */
export async function convertImage(
  srcPath,
  destPath,
  { width = 1200, height = 900, fit = "inside", quality = 75, log } = {},
) {
  const say = log ?? (() => {});
  if (!process.env.FORCE && existsSync(destPath)) {
    say(`  skip (exists): ${destPath}`);
    return false;
  }

  const pipeline = sharp(srcPath).resize({
    width,
    height,
    fit,
    withoutEnlargement: fit === "inside",
  });

  const ext = extname(destPath).toLowerCase();
  if (ext === ".webp") pipeline.webp({ quality });
  else if (ext === ".jpg" || ext === ".jpeg")
    pipeline.jpeg({ quality, mozjpeg: true });
  else if (ext === ".avif") pipeline.avif({ quality });
  else throw new Error(`Unsupported output format: ${destPath}`);

  await pipeline.toFile(destPath);

  const meta = await sharp(destPath).metadata();
  const kb = Math.round((meta.size ?? 0) / 1024);
  say(`  → ${destPath} (${meta.width}×${meta.height}, ${kb}KB)`);
  return true;
}
