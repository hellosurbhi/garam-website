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
