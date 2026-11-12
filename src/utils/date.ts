/**
 * General date utilities shared across data and page layers.
 */

/**
 * Returns true if dateStr (YYYY-MM-DD) is today or in the past.
 * Uses UTC-normalized comparison to avoid timezone boundary mismatches.
 */
export function isPublished(dateStr: string): boolean {
  const pub = new Date(dateStr + "T00:00:00Z");
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  return pub <= today;
}

/**
 * The calendar day the public site treats as "today", as YYYY-MM-DD.
 * WHY UTC and not the viewer's zone: the pages pick upcoming shows at build
 * and request time on servers that run in UTC, so anything that previews
 * that choice (the admin Shows tab) must use the same day or it lists a
 * show the site has already dropped.
 */
export function utcTodayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
