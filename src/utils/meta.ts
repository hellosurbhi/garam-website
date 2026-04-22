const BRAND = "Garam Masala Dating";
// 43 chars + " | Garam Masala Dating" (22) = 65 — Bing's title length limit
const TITLE_LIMIT = 43;

/** HTML <title> — page keywords first for SEO */
export function pageTitle(name: string): string {
  return `${name} | ${BRAND}`;
}

/** og:title / twitter:title — brand first for social sharing & iMessage */
export function ogTitle(name: string): string {
  return `${BRAND} | ${name}`;
}

/**
 * Derive a short SEO title from a long display title.
 * Splits at the first colon if it falls within the limit;
 * otherwise truncates at the last word boundary before the limit.
 */
export function deriveSeoTitle(title: string): string {
  if (title.length <= TITLE_LIMIT) return title;
  const colonIdx = title.indexOf(":");
  if (colonIdx > 0 && colonIdx <= TITLE_LIMIT)
    return title.slice(0, colonIdx).trimEnd();
  const truncated = title.slice(0, TITLE_LIMIT);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}
