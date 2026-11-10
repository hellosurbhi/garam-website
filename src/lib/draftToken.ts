import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { readTrimmedEnv } from "@/lib/env";
import { deriveDraftSecret } from "@/lib/draftSecret";

/**
 * Capability token for one apply-form draft. Whoever holds the token may
 * update that one draft and nothing else; a draft ID alone is never enough,
 * so nobody can overwrite another applicant's answers by guessing an ID.
 *
 * Format: base64url(draftId/expiresAtBase36/hmac). '/' cannot appear in a
 * Firestore document ID, so it is a safe delimiter (same scheme as
 * leadToken.ts).
 *
 * WHY the secret falls back to a key derived from the Firebase service
 * account key instead of requiring a new env var (the leadToken.ts opt-in
 * pattern): an opt-in secret that is unset turns the apply form OFF, and
 * "the form silently depends on an env var nobody set" is the outage class
 * this rewrite exists to remove. The service-account key is already
 * mandatory for any server write to Firestore, so if the endpoint can save
 * at all, it can sign. The "apply-draft-token" prefix domain-separates the
 * derived key from every other use of that private key. DRAFT_TOKEN_SECRET
 * overrides it for rotation without touching the Firebase credential. What
 * breaks if this changes: tokens already sitting in applicants' browsers
 * stop verifying; the client then starts a fresh draft and re-sends every
 * field, so nothing is lost, but the old draft is orphaned.
 */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getSecret(): string {
  return deriveDraftSecret(
    readTrimmedEnv(import.meta.env.DRAFT_TOKEN_SECRET),
    readTrimmedEnv(import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY),
  );
}

/** 128-bit random draft ID, hex. Also the Firestore document ID. */
export function newDraftId(): string {
  return randomBytes(16).toString("hex");
}

export function isDraftId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function issueDraftToken(draftId: string, now = Date.now()): string {
  const payload = `${draftId}/${(now + TOKEN_TTL_MS).toString(36)}`;
  return Buffer.from(`${payload}/${sign(payload)}`).toString("base64url");
}

export type DraftTokenResult =
  | { ok: true; draftId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Verify a token and say exactly why it failed, for the exact-detail alerts. */
export function verifyDraftToken(
  token: unknown,
  now = Date.now(),
): DraftTokenResult {
  if (typeof token !== "string" || token.length === 0 || token.length > 512) {
    return { ok: false, reason: "malformed" };
  }
  try {
    const parts = Buffer.from(token, "base64url").toString().split("/");
    if (parts.length !== 3) return { ok: false, reason: "malformed" };
    const [draftId, exp, sig] = parts;
    if (!isDraftId(draftId)) return { ok: false, reason: "malformed" };
    const expected = sign(`${draftId}/${exp}`);
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return { ok: false, reason: "bad_signature" };
    }
    if (now > parseInt(exp, 36)) return { ok: false, reason: "expired" };
    return { ok: true, draftId };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
