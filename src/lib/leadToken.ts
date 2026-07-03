import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = import.meta.env.LEAD_UPDATE_SECRET;
  if (!secret) throw new Error("LEAD_UPDATE_SECRET not configured");
  return secret;
}

/**
 * Issue a signed token for a lead document ID.
 * Token format: base64url(docId/timestamp/hmac)
 * Uses '/' as delimiter — Firestore document IDs cannot contain '/'.
 */
export function issueLeadToken(docId: string): string {
  const ts = Date.now().toString(36);
  const payload = `${docId}/${ts}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}/${sig}`).toString("base64url");
}

/**
 * Verify a lead update token. Returns the doc ID if valid, null otherwise.
 */
export function verifyLeadToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split("/");
    if (parts.length !== 3) return null;

    const [docId, ts, sig] = parts;
    const payload = `${docId}/${ts}`;
    const expected = createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex");

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
