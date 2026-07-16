export function cleanInstagramHandle(raw: string): string {
  return raw.replace(/^@/, "");
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${cleanInstagramHandle(handle)}`;
}
