/**
 * optimize-images.js
 *
 * Named one-off images. Two jobs:
 *
 *   1. Convert raws from src/assets/show-raw/ into descriptively named
 *      WebP files in public/images/promo/ (NAMED_IMAGES below).
 *   2. Produce the 1200x630 Open Graph crop at public/og-image.jpg.
 *
 * Most committed promo artifacts (on-stage.webp, the-match.webp, ...) were
 * generated from raw exports that predate this repo and are not in version
 * control. Treat them as committed artifacts: this script will never touch
 * them because their raws are gone. To add a new named image, drop the raw
 * into src/assets/show-raw/ and add a { src, name } entry to NAMED_IMAGES.
 *
 * Existing outputs are skipped (idempotent, safe to re-run). FORCE=1
 * re-processes everything.
 *
 * Usage:
 *   npm run images:optimize          # silent
 *   npm run images:optimize:v        # verbose (VERBOSE=1)
 *
 * For the sequential hf-NN/show-NN photo pools, use images:organize
 * (scripts/organize-images.js) instead.
 */

import { existsSync } from "fs";
import { resolve, join } from "path";
import { convertImage, ensureDir, makeLogger } from "./lib/image-utils.js";

const ROOT = resolve(import.meta.dirname, "..");
const RAW_DIR = join(ROOT, "src", "assets", "show-raw");
const PROMO_DIR = join(ROOT, "public", "images", "promo");
const OG_OUTPUT = join(ROOT, "public", "og-image.jpg");
const OG_SOURCE = join(RAW_DIR, "Garammasaladating-7.jpg");

const log = makeLogger();
const missingFiles = [];

// { src: filename inside src/assets/show-raw/, name: output basename }
// Example: { src: "Garammasaladating-89.jpg", name: "finale-bow" }
const NAMED_IMAGES = [];

async function processNamedImage({ src, name }) {
  const input = join(RAW_DIR, src);
  if (!existsSync(input)) {
    missingFiles.push(src);
    console.error(`  MISSING: src/assets/show-raw/${src}`);
    return;
  }
  await convertImage(input, join(PROMO_DIR, `${name}.webp`), {
    width: 1200,
    height: 1200,
    quality: 75,
    log,
  });
}

async function processOgImage() {
  if (!existsSync(OG_SOURCE)) {
    missingFiles.push("Garammasaladating-7.jpg");
    console.error(`  MISSING: OG image source (${OG_SOURCE})`);
    return;
  }
  log("OG image (1200x630 crop):");
  await convertImage(OG_SOURCE, OG_OUTPUT, {
    width: 1200,
    height: 630,
    fit: "cover",
    quality: 85,
    log,
  });
}

async function main() {
  ensureDir(PROMO_DIR);

  log(`Named images: ${NAMED_IMAGES.length}`);
  for (const image of NAMED_IMAGES) {
    await processNamedImage(image);
  }

  await processOgImage();

  if (missingFiles.length > 0) {
    console.error(`\nFailed: ${missingFiles.length} source image(s) not found`);
    process.exit(1);
  }

  log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
