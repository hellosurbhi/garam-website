/**
 * Shared origin allowlist for public POST endpoints. Blocks casual cross-site
 * abuse of endpoints that send email or write data; not a substitute for rate
 * limiting (Origin can be forged by non-browser clients), which stays on
 * every endpoint that uses this.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "https://garammasaladating.com") return true;
  if (/^https:\/\/[\w-]+-hellosurbhi\.vercel\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}
