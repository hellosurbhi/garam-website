/**
 * organize-images.js
 *
 * Converts raw photos into optimized WebP files in two pools:
 *
 *   src/assets/hf-raw/   → public/images/hf/hf-01.webp … hf-N.webp
 *   src/assets/show-raw/ → public/images/show/show-01.webp … show-N.webp
 *
 * ── Sunday workflow ──────────────────────────────────────────────────────────
 * After a show, drop 5-10 new JPG/PNG photos into src/assets/show-raw/
 * and run:  npm run images:organize
 *
 * New files get the next sequential number. Existing output files are skipped
 * (idempotent), so re-running is safe. To force re-process, delete the output.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   npm run images:organize          # silent
 *   npm run images:organize:v        # verbose (VERBOSE=1)
 */

import { readdirSync, existsSync } from "fs";
import { resolve, join, extname } from "path";
import { convertImage, ensureDir, makeLogger } from "./lib/image-utils.js";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC = join(ROOT, "public");
const HF_SRC = join(ROOT, "src", "assets", "hf-raw");
const SHOW_SRC = join(ROOT, "src", "assets", "show-raw");
const HF_OUT = join(PUBLIC, "images", "hf");
const SHOW_OUT = join(PUBLIC, "images", "show");

const log = makeLogger();

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

// Ensure output dirs exist
for (const d of [HF_OUT, SHOW_OUT]) {
  ensureDir(d);
}

/** Convert and output a single image as WebP, skipping if output exists. Returns null on failure. */
async function toWebP(srcPath, destPath) {
  return convertImage(srcPath, destPath, { log });
}

/** Read and sort source files from a directory. */
function listSources(dir, numericSort = false) {
  if (!existsSync(dir)) {
    log(`  (no source dir: ${dir.replace(ROOT, "")})`);
    return [];
  }
  const files = readdirSync(dir)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .filter((f) => !f.startsWith("."));

  if (numericSort) {
    // Sort by the first run of digits in the filename (e.g. Garammasaladating-7 < -37 < -70)
    files.sort((a, b) => {
      const na = parseInt((a.match(/(\d+)/) ?? ["0", "0"])[1]);
      const nb = parseInt((b.match(/(\d+)/) ?? ["0", "0"])[1]);
      return na - nb || a.localeCompare(b);
    });
  } else {
    files.sort();
  }

  return files.map((f) => join(dir, f));
}

async function main() {
  const failedFiles = [];

  // ── HF pool ────────────────────────────────────────────────────────────────
  const hfSources = listSources(HF_SRC, false);
  log(
    `\nHF pool: ${hfSources.length} source(s) → ${HF_OUT.replace(ROOT, "")}/`,
  );
  for (let i = 0; i < hfSources.length; i++) {
    const name = `hf-${String(i + 1).padStart(2, "0")}.webp`;
    const result = await toWebP(hfSources[i], join(HF_OUT, name));
    if (result === null) failedFiles.push(hfSources[i]);
  }

  // ── Show pool ──────────────────────────────────────────────────────────────
  const showSources = listSources(SHOW_SRC, true);
  log(
    `\nShow pool: ${showSources.length} source(s) → ${SHOW_OUT.replace(ROOT, "")}/`,
  );
  for (let i = 0; i < showSources.length; i++) {
    const name = `show-${String(i + 1).padStart(2, "0")}.webp`;
    const result = await toWebP(showSources[i], join(SHOW_OUT, name));
    if (result === null) failedFiles.push(showSources[i]);
  }

  // Summary
  const hfOut = existsSync(HF_OUT)
    ? readdirSync(HF_OUT).filter((f) => f.endsWith(".webp")).length
    : 0;
  const showOut = existsSync(SHOW_OUT)
    ? readdirSync(SHOW_OUT).filter((f) => f.endsWith(".webp")).length
    : 0;
  log(`\nDone. HF: ${hfOut} files, Show: ${showOut} files.`);

  if (failedFiles.length > 0) {
    console.error(`\nFailed: ${failedFiles.length} image(s) could not be converted`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
