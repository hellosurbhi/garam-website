/**
 * Image pools for journal and city pages.
 *
 * HF_IMAGES  — AI-generated host portraits (src/assets/hf-raw/)
 *               Assigned to journal post pages, cycling deterministically.
 *
 * SHOW_IMAGES — Real show photos (src/assets/show-raw/ + existing gallery)
 *               Assigned to city landing pages, cycling deterministically.
 *
 * To add more show photos after a Sunday show:
 *   1. Drop new JPG/PNG files into src/assets/show-raw/
 *   2. Run: npm run images:organize
 *   3. Update the `length` in SHOW_IMAGES below to match new total count
 */

/** AI-generated host images for journal post hero photos */
export const HF_IMAGES: readonly string[] = [
  ...Array.from(
    { length: 26 },
    (_, i) => `/images/hf/hf-${String(i + 1).padStart(2, '0')}.webp`
  ),
  '/images/higgs-field.webp',
];

/** Real show photos for city page hero images */
export const SHOW_IMAGES: readonly string[] = [
  ...Array.from(
    { length: 5 },
    (_, i) => `/images/show/show-${String(i + 1).padStart(2, '0')}.webp`
  ),
  '/images/on-stage.webp',
  '/images/the-match.webp',
  '/images/the-crowd.webp',
  '/images/pure-chaos.webp',
  '/images/after-party.webp',
  '/images/magic-moment.webp',
  '/images/testimonial-reaction.webp',
];

/**
 * Maps a slug to a stable index into a pool.
 * Using a hash rather than array position means adding new posts/cities
 * never changes the image assigned to an existing page.
 */
export function slugToImageIndex(slug: string, poolSize: number): number {
  let h = 0;
  for (const c of slug) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h) % poolSize;
}
