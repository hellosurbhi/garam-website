/** Strip leading @ from Instagram handle */
export function cleanInstagramHandle(raw: string): string {
  return raw.replace(/^@/, "");
}

/** Build full Instagram profile URL from handle */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}
