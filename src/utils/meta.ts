const BRAND = "Garam Masala Dating";

/** HTML <title> — page keywords first for SEO */
export function pageTitle(name: string): string {
  return `${name} | ${BRAND}`;
}

/** og:title / twitter:title — brand first for social sharing & iMessage */
export function ogTitle(name: string): string {
  return `${BRAND} | ${name}`;
}
