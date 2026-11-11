/**
 * Pure logic for the apply-form save endpoint (src/pages/api/save-application.ts):
 * which fields a client may write, how raw form input becomes a document, and
 * how a late or duplicate request merges into the stored draft.
 *
 * The rule this file enforces: the server NEVER rejects an applicant over the
 * content of what they typed. It coerces, trims absurd lengths (bot scale,
 * not human scale) and drops keys it does not know. Everything else is saved.
 * Eligibility judgements (under 18, missing photo) are stored as flags for the
 * admin dashboard, never as errors to the applicant.
 */

/** Form fields a client may write. Everything else is server-controlled. */
export const FORM_FIELD_KEYS = [
  "applicationType",
  "name",
  "age",
  "gender",
  "orientation",
  "country",
  "state",
  "city",
  "email",
  "phone",
  "height",
  "instagram",
  "community",
  "income",
  "referrerName",
  "nominationConsent",
  "pitch",
  "type",
  "seenShowBefore",
  "howHeard",
  "marketingConsent",
  "termsAgreed",
  "photoUploadFailed",
] as const;

export type FormFieldKey = (typeof FORM_FIELD_KEYS)[number];

/**
 * Invisible ceilings against floods only. A human never gets near these (the
 * pitch ceiling is a 40 page essay). They exist because Firestore rejects a
 * document over 1MB, so SOME bound must exist; truncating is the only
 * behaviour that never costs an applicant their submission.
 */
const MAX_CHARS = {
  pitch: 100_000,
  email: 320,
  phone: 100,
  instagram: 300,
  short: 200,
  text: 5_000,
} as const;

const SHORT_KEYS = new Set<string>([
  "country",
  "state",
  "gender",
  "orientation",
  "community",
  "income",
  "howHeard",
]);

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Age as the person typed it: any integer is kept, no upper bound. Only a
 * value too large to store exactly is dropped (null).
 * WHY: a pasted 23-digit number became 1e+23, which Firestore refuses as an
 * integerValue, failing every later save of the whole draft over one field.
 */
function parseAge(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseInt(str(value), 10);
  const whole = Math.trunc(n);
  return Number.isSafeInteger(whole) ? whole : null;
}

export interface SanitizedFields {
  /** Document fields to store, keyed by document field name. */
  values: Record<string, unknown>;
  /** Client keys that were present in the request, for per-field rev checks. */
  keys: FormFieldKey[];
}

/**
 * Turn raw client input into document fields. Unknown keys are dropped,
 * wrong types are coerced to something storable, and nothing throws.
 */
export function sanitizeFields(raw: unknown): SanitizedFields {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const values: Record<string, unknown> = {};
  const keys: FormFieldKey[] = [];

  for (const key of FORM_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    keys.push(key);

    switch (key) {
      case "applicationType":
        values.applicationType =
          str(value) === "Nomination" ? "Nomination" : "Self";
        break;
      case "age": {
        const age = parseAge(value);
        values.age = age;
        values.ageUnder18 = age !== null && age < 18;
        break;
      }
      case "email": {
        const email = clip(str(value).trim(), MAX_CHARS.email);
        values.email = email;
        values.emailNormalized = email.toLowerCase();
        break;
      }
      case "instagram":
        values.instagram = clip(
          str(value).trim().replace(/^@/, ""),
          MAX_CHARS.instagram,
        );
        break;
      case "phone":
        values.phone = clip(str(value).trim(), MAX_CHARS.phone);
        break;
      case "pitch":
        values.pitch = clip(str(value).trim(), MAX_CHARS.pitch);
        break;
      case "nominationConsent":
        values.nominationConsent = value === true;
        break;
      case "photoUploadFailed":
        // Set by the client at submit when a photo could not be filed, so the
        // admin dashboard can show the "Photos failed" pill and chase them.
        values.photoUploadFailed = value === true;
        break;
      case "termsAgreed":
        // Stored as termsAgreedAt by the endpoint (needs the server clock).
        values.termsAgreed = value === true;
        break;
      case "seenShowBefore": {
        const v = str(value);
        values.seenShowBefore =
          v === "yes" || value === true
            ? true
            : v === "no" || value === false
              ? false
              : null;
        break;
      }
      case "marketingConsent": {
        const v = str(value);
        values.marketingConsent = v === "yes" || v === "no" ? v : "";
        break;
      }
      default:
        values[key] = clip(
          str(value).trim(),
          SHORT_KEYS.has(key) ? MAX_CHARS.short : MAX_CHARS.text,
        );
    }
  }
  return { values, keys };
}

/** Per-field revision map stored on the draft as `fieldRevs`. */
export type FieldRevs = Record<string, number>;

export interface MergeResult {
  /** Fields to write (already includes fieldRevs.<key> updates). */
  patch: Record<string, unknown>;
  /** Client keys that were applied (not stale). */
  applied: FormFieldKey[];
  /** Client keys ignored because a newer revision is already stored. */
  stale: FormFieldKey[];
}

/** Which document fields a client key controls (a key may own several). */
export function docFieldsFor(key: FormFieldKey): string[] {
  switch (key) {
    case "age":
      return ["age", "ageUnder18"];
    case "email":
      return ["email", "emailNormalized"];
    default:
      return [key];
  }
}

/**
 * Merge a sanitized request into the stored draft, per field. A field is
 * applied only when this request's rev is at least the rev that last wrote
 * it, so a delayed request can never overwrite newer answers, and a
 * duplicate (same rev, same value) is an idempotent no-op in effect.
 */
export function mergeDraft(
  existing: Record<string, unknown>,
  incoming: SanitizedFields,
  rev: number,
): MergeResult {
  const storedRevs =
    existing.fieldRevs && typeof existing.fieldRevs === "object"
      ? (existing.fieldRevs as FieldRevs)
      : {};
  const patch: Record<string, unknown> = {};
  const applied: FormFieldKey[] = [];
  const stale: FormFieldKey[] = [];

  for (const key of incoming.keys) {
    const last = typeof storedRevs[key] === "number" ? storedRevs[key] : -1;
    if (rev < last) {
      stale.push(key);
      continue;
    }
    applied.push(key);
    for (const docField of docFieldsFor(key)) {
      if (docField in incoming.values)
        patch[docField] = incoming.values[docField];
    }
    patch[`fieldRevs.${key}`] = rev;
  }
  return { patch, applied, stale };
}

/** A string field's length, for the exact-detail failure alerts. */
export function fieldLengths(
  values: Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string") out[k] = v.length;
  }
  return out;
}
