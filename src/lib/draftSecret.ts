import { createHash, createHmac } from "crypto";

/**
 * Pure (no import.meta) so the Playwright canary can derive the exact same
 * secret from the GitHub-held service-account key and sign its own requests.
 * See src/lib/draftToken.ts for why this derives from the service-account key
 * instead of requiring a new env var.
 */
export function deriveDraftSecret(
  explicitSecret: string | undefined,
  firebasePrivateKey: string | undefined,
): string {
  const explicit = explicitSecret?.trim();
  if (explicit) return explicit;
  const key = firebasePrivateKey?.trim();
  if (!key) {
    throw new Error(
      "DRAFT_TOKEN_SECRET or FIREBASE_ADMIN_PRIVATE_KEY is required to sign apply drafts",
    );
  }
  return createHash("sha256").update(`apply-draft-token:${key}`).digest("hex");
}

/** Production canary identities. One fixed draft per real-browser profile. */
export const CANARY_KEYS = [
  "iphone-safari",
  "android-chrome",
  "instagram-webview",
] as const;
export type CanaryKey = (typeof CANARY_KEYS)[number];

export function isCanaryKey(value: unknown): value is CanaryKey {
  return (CANARY_KEYS as readonly unknown[]).includes(value);
}

/** Deterministic draft ID for a canary key (32 hex, same shape as real IDs). */
export function canaryDraftId(key: CanaryKey): string {
  return createHash("sha256")
    .update(`canary:${key}`)
    .digest("hex")
    .slice(0, 32);
}

/** How far a canary timestamp may drift from the server clock. */
export const CANARY_SIGNATURE_WINDOW_SECONDS = 300;

/**
 * WHY the timestamp is signed: the first version signed only the profile name,
 * so one leaked header value (a CI log, an artifact) worked forever. Binding
 * the signature to a unix-seconds timestamp the server only accepts inside a
 * short window makes a leaked value useless after minutes. Dropping the
 * timestamp makes the canary credential permanent again.
 */
export function canarySignature(
  secret: string,
  key: CanaryKey,
  timestampSeconds: number,
): string {
  return createHmac("sha256", secret)
    .update(`canary:${key}:${timestampSeconds}`)
    .digest("hex");
}
