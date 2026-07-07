import { timingSafeEqual } from "node:crypto";

export function verifyCronSecret(request: Request): boolean {
  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) return false;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
