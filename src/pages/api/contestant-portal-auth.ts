import type { APIRoute } from "astro";
import { createHmac, timingSafeEqual } from "crypto";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { ContestantPrepAuthSchema } from "@/lib/schemas";

export const prerender = false;

function computeSig(salt: string, date: string): string {
  return createHmac("sha256", salt).update(date).digest("hex");
}

function computeToken(salt: string, date: string): string {
  return createHmac("sha256", salt).update(`token-${date}`).digest("hex");
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function getShowExpiryMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  // EDT (UTC-4) Apr–Oct, EST (UTC-5) Nov–Mar
  const offsetHours = m >= 4 && m <= 10 ? 4 : 5;
  // Midnight ending the show day = 00:00 ET on the next calendar day
  return Date.UTC(y, m - 1, d + 1, offsetHours, 0, 0);
}

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(
    request,
    RATE_LIMITS.contestantPrepAuth,
  );
  if (limited) return limited;

  const salt = import.meta.env.CONTESTANT_PREP_SALT;
  if (!salt) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const parsed = await parseJsonRequest(request, ContestantPrepAuthSchema);
  if (!parsed.success) return parsed.response;
  const { date, sig } = parsed.data;

  const expected = computeSig(salt, date);
  if (!timingSafeCompare(sig, expected)) {
    return jsonResponse({ error: "Invalid link" }, 401);
  }

  const expiresAt = getShowExpiryMs(date);
  if (Date.now() >= expiresAt) {
    return jsonResponse({ error: "Link expired" }, 401);
  }

  return jsonResponse({ token: computeToken(salt, date), expiresAt });
};
