import { timingSafeEqual } from "node:crypto";

/**
 * Checks the `Authorization: Bearer <CRON_SECRET>` header Vercel Cron sends.
 * Compared with timingSafeEqual so response timing cannot be used to guess the
 * secret one character at a time. Fails closed when CRON_SECRET is unset.
 */
export function verifyCronSecret(request: Request): boolean {
  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) return false;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  // timingSafeEqual throws on unequal lengths, so length is checked first.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
