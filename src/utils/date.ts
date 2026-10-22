/**
 * General date utilities shared across data and page layers.
 */

/**
 * Parses a timestamp value into milliseconds since epoch.
 * Handles ISO date strings (from the Firestore REST API) and Firestore
 * Timestamp objects (from the Firebase client SDK). Returns null for any
 * missing or unparseable value so callers can treat null as "not set".
 */
export function toMs(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === "string") {
    const ms = Date.parse(val);
    return isNaN(ms) ? null : ms;
  }
  if (
    typeof val === "object" &&
    typeof (val as Record<string, unknown>).toDate === "function"
  ) {
    return (val as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

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
