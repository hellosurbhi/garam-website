import { createHmac, timingSafeEqual } from "crypto";
import { readTrimmedEnv } from "@/lib/env";

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// The token feature is opt-in via LEAD_UPDATE_SECRET, mirroring the
// Turnstile and Upstash patterns: unset secret means issue/verify return
// null and callers fall back to the legacy doc-id flow, so deploying this
// code before the env var exists changes nothing in prod.
function getLeadUpdateSecret(): string | null {
  return readTrimmedEnv(import.meta.env.LEAD_UPDATE_SECRET) ?? null;
}

export function isLeadTokenEnabled(): boolean {
  return getLeadUpdateSecret() !== null;
}

/**
 * Issue a signed token for a lead document ID, or null when the feature
 * is disabled. Token format: base64url(docId/timestamp/hmac).
 * Uses '/' as delimiter — Firestore document IDs cannot contain '/'.
 */
export function issueLeadToken(docId: string): string | null {
  const secret = getLeadUpdateSecret();
  if (!secret) return null;

  const ts = Date.now().toString(36);
  const payload = `${docId}/${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}/${sig}`).toString("base64url");
}

/**
 * Verify a lead update token. Returns the doc ID if valid, null otherwise
 * (including when the feature is disabled — callers must check
 * isLeadTokenEnabled() to distinguish "feature off" from "bad token").
 */
export function verifyLeadToken(token: string): string | null {
  const secret = getLeadUpdateSecret();
  if (!secret) return null;

  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split("/");
    if (parts.length !== 3) return null;

    const [docId, ts, sig] = parts;
    const payload = `${docId}/${ts}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const issued = parseInt(ts, 36);
    if (Date.now() - issued > TOKEN_TTL_MS) return null;

    return docId;
  } catch {
    return null;
  }
}
