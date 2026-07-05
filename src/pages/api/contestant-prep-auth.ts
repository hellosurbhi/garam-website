import type { APIRoute } from "astro";
import { createHmac, timingSafeEqual } from "crypto";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const prerender = false;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { date, sig } = (await request.json()) as {
    date?: string;
    sig?: string;
  };

  if (!date || !sig || typeof date !== "string" || typeof sig !== "string") {
    return new Response(
      JSON.stringify({ error: "date and sig are required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!ISO_DATE_RE.test(date)) {
    return new Response(JSON.stringify({ error: "Invalid date format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expected = computeSig(salt, date);
  if (!timingSafeCompare(sig, expected)) {
    return new Response(JSON.stringify({ error: "Invalid link" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expiresAt = getShowExpiryMs(date);
  if (Date.now() >= expiresAt) {
    return new Response(JSON.stringify({ error: "Link expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ token: computeToken(salt, date), expiresAt }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
