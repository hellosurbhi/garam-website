import { timingSafeEqual } from "node:crypto";

export function verifyCronSecret(request: Request): boolean {
  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) return false;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
