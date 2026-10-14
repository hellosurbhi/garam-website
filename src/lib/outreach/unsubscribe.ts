import { createHmac, timingSafeEqual } from "node:crypto";
function secret() {
  const key = import.meta.env.OUTREACH_UNSUBSCRIBE_SECRET;
  if (!key || key.length < 32)
    throw new Error("Email unsubscribe signing is not configured");
  return key;
}
export function unsubscribeToken(email: string) {
  const value = Buffer.from(email).toString("base64url");
  return `${value}.${createHmac("sha256", secret()).update(value).digest("base64url")}`;
}
export function readUnsubscribeToken(token: string): string | null {
  if (token.length > 600) return null;
  const [value, sig, extra] = token.split(".");
  if (!value || !sig || extra) return null;
  const expected = createHmac("sha256", secret()).update(value).digest();
  const actual = Buffer.from(sig, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? Buffer.from(value, "base64url").toString()
    : null;
}
