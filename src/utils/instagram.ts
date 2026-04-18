/** Strip leading @ from Instagram handle */
export function cleanInstagramHandle(raw: string): string {
  return raw.replace(/^@/, "");
}

/**
 * Canonical normalized handle: trim whitespace, then strip leading `@`.
 * Returns empty string when the input is only whitespace or a bare `@`.
 * Use this before validating or persisting.
 */
export function normalizeInstagramHandle(raw: string): string {
  return cleanInstagramHandle(raw.trim());
}

/** Build full Instagram profile URL from handle */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}
