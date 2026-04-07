import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');
const GALLERY_DIR = join(PUBLIC, 'images', 'gallery');

const VERBOSE = !!process.env.VERBOSE;
const log = (...args) => { if (VERBOSE) console.log(...args); };
const logError = (...args) => { if (VERBOSE) console.error(...args); };

// Ensure output dirs exist
[GALLERY_DIR].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

// Gallery images: 8 photos mapped to descriptive names
const galleryImages = [
  { src: '_U7A8432-2.jpg',                      name: 'on-stage' },
  { src: '_U7A8858.jpg',                         name: 'the-match' },
  { src: 'src/data/Garammasaladating-117.jpg',   name: 'hosts' },
  { src: 'src/components/Garammasaladating-14.jpg', name: 'the-crowd' },
  { src: 'src/components/Garammasaladating-45.jpg', name: 'pure-chaos' },
  { src: 'src/components/Garammasaladating-66.jpg', name: 'after-party' },
  { src: 'src/components/Garammasaladating-68.jpg', name: 'magic-moment' },
  { src: '_U7A9273.jpg',                         name: 'dance-off' },
];

// Other page images
const otherImages = [
  { src: 'src/data/Garammasaladating-12.jpg',    name: 'tickets-hero',          dir: join(PUBLIC, 'images') },
  { src: 'src/components/Garammasaladating-16.jpg', name: 'testimonial-reaction', dir: join(PUBLIC, 'images') },
  { src: 'src/components/Garammasaladating-1.jpg',  name: 'links-hero',          dir: join(PUBLIC, 'images') },
  { src: '_U7A8276.jpg',                         name: 'journal-featured',      dir: join(PUBLIC, 'images') },
];

async function processImage(srcPath, outputDir, outputName, maxWidth = 1200) {
  const input = join(ROOT, srcPath);
  if (!existsSync(input)) {
    logError(`  SKIP (not found): ${srcPath}`);
    return;
  }

  const img = sharp(input);
  const meta = await img.metadata();
  log(`  ${srcPath} — ${meta.width}x${meta.height} (${(meta.size / 1024 / 1024).toFixed(1)}MB)`);

  const resized = img.resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true });

  // AVIF
  await resized.clone().avif({ quality: 65 }).toFile(join(outputDir, `${outputName}.avif`));
  // WebP
  await resized.clone().webp({ quality: 75 }).toFile(join(outputDir, `${outputName}.webp`));
  // JPG fallback
  await resized.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(join(outputDir, `${outputName}.jpg`));

  // Report output sizes
  for (const ext of ['avif', 'webp', 'jpg']) {
    const out = join(outputDir, `${outputName}.${ext}`);
    const outMeta = await sharp(out).metadata();
    const sizeKB = (outMeta.size / 1024).toFixed(0);
    log(`    → ${outputName}.${ext}: ${outMeta.width}x${outMeta.height} (${sizeKB}KB)`);
  }
}

async function processOgImage() {
  const src = join(ROOT, 'src/data/Garammasaladating-7.jpg');
  if (!existsSync(src)) {
    logError('  SKIP OG image (not found)');
    return;
  }

  log('\nOG Image (1200x630 crop):');
  const img = sharp(src);
  const meta = await img.metadata();
  log(`  source: ${meta.width}x${meta.height}`);

  // Resize to cover 1200x630, then extract center
  await img
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(join(PUBLIC, 'og-image.jpg'));

  const outMeta = await sharp(join(PUBLIC, 'og-image.jpg')).metadata();
  log(`  → og-image.jpg: ${outMeta.width}x${outMeta.height} (${(outMeta.size / 1024).toFixed(0)}KB)`);
}

async function main() {
  log('=== Gallery Images (8) ===\n');
  for (const img of galleryImages) {
    await processImage(img.src, GALLERY_DIR, img.name);
    log('');
  }

  log('\n=== Other Page Images (4) ===\n');
  for (const img of otherImages) {
    await processImage(img.src, img.dir, img.name);
    log('');
  }

  await processOgImage();

  log('\nDone! All images optimized.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
