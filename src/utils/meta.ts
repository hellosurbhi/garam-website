const BRAND = "Garam Masala Dating";
// 43 chars + " | Garam Masala Dating" (22) = 65 — Bing's title length limit
const TITLE_LIMIT = 43;

// Function words that look incomplete at the end of a title — Google treats
// these as low-quality and may replace the title with the raw URL.
const DANGLING = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "by",
  "from",
  "with",
  "and",
  "or",
  "but",
  "is",
  "as",
  "vs",
  "your",
  "my",
  "our",
  "their",
]);

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
 * otherwise truncates at the last word boundary before the limit,
 * then backs up past any trailing function words so the title doesn't
 * end on a dangling preposition/article/conjunction.
 */
export function deriveSeoTitle(title: string): string {
  if (title.length <= TITLE_LIMIT) return title;
  const colonIdx = title.indexOf(":");
  if (colonIdx > 0 && colonIdx <= TITLE_LIMIT)
    return title.slice(0, colonIdx).trimEnd();
  const truncated = title.slice(0, TITLE_LIMIT);
  // If the slice lands exactly on a word boundary (next char is space/punct),
  // use it as-is rather than backing up and losing the last word.
  const atWordBoundary =
    title.length === TITLE_LIMIT || /[\s([,;]/.test(title[TITLE_LIMIT]);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = (
    atWordBoundary
      ? truncated
      : lastSpace > 0
        ? truncated.slice(0, lastSpace)
        : truncated
  ).trimEnd();
  const words = base.split(" ");
  while (
    words.length > 1 &&
    (DANGLING.has(words[words.length - 1].toLowerCase()) ||
      words[words.length - 1].startsWith("("))
  ) {
    words.pop();
  }
  return words.join(" ");
}
