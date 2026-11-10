/**
 * Shared origin allowlist for public POST endpoints. Blocks casual cross-site
 * abuse of endpoints that send email or write data; not a substitute for rate
 * limiting (Origin can be forged by non-browser clients), which stays on
 * every endpoint that uses this.
 */
/**
 * Origin gate for the apply form's endpoints. A browser that sends no Origin
 * header is let through, because a real applicant must never be turned away
 * over a header; a foreign Origin is still refused. These endpoints are
 * protected by the draft token and the rate limiter, not by Origin.
 */
export function isAllowedApplyOrigin(origin: string | null): boolean {
  return origin === null || origin === "" || isAllowedOrigin(origin);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "https://garammasaladating.com") return true;
  if (/^https:\/\/[\w-]+-hellosurbhi\.vercel\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}
