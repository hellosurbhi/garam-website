/**
 * Client-side ceilings for apply-form text fields.
 *
 * WHY these exist at all: Firestore hard-rejects any document over 1MB, so
 * some bound must exist somewhere. The owner's rule (2026-08-30) is that no
 * real person may ever see a length restriction: free-text ceilings are set
 * far beyond anything a human writes (PITCH = 50,000 characters, roughly a
 * 20 page essay) and exist only to stop bot floods. Structured fields keep
 * format-sized caps (email 320 per RFC 5321, phone 50) because the format
 * itself defines them.
 *
 * WHY firestore.rules caps are 4x these numbers: rules `size()` and JS
 * `.length` count differently for multi-byte text (UTF-16 code units vs
 * bytes/code points; an emoji is 2 in JS and up to 4 in UTF-8). A string
 * that passes a client check of N UTF-16 units can never exceed 4N under
 * any counting scheme, so RULES cap = 4 x CLIENT cap guarantees "if submit
 * is clickable, Firestore accepts it" without pinning the exact semantics.
 * If you change a number here, change its 4x partner in firestore.rules and
 * the pinning tests in test/rules/apply-flow.rules-test.ts.
 *
 * The form never renders these as maxLength attributes or counters: the only
 * user-visible surface is an inline field error when a ceiling is actually
 * crossed (see getFieldErrors in useApplyForm.ts).
 */
export const FIELD_LIMITS = {
  /** Free text a human writes: name, city, height, type, referrerName. */
  freeText: 1_000,
  /** The pitch: let them make their case at any length a human writes. */
  pitch: 50_000,
  /** RFC 5321 maximum length of an email address. */
  email: 320,
  /** Generous for any international number with formatting. */
  phone: 50,
  /** Instagram's own maximum is 30; headroom for pasted URLs and typos. */
  instagram: 100,
} as const;

/** Plain-words inline error shown only when a ceiling is actually crossed. */
export function overLimitMessage(limit: number): string {
  return `This is over ${limit.toLocaleString("en-US")} characters, please trim it down a little`;
}
