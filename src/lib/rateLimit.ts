import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { API_MESSAGES } from "@/lib/messages";

const redis = new Redis({
  url: import.meta.env.UPSTASH_REDIS_REST_URL,
  token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Rate limiter for /api/notify-application
 * 5 requests per 60 seconds per IP
 */
export const notifyApplicationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "ratelimit:notify-application",
});

/**
 * Rate limiter for /api/capture-lead
 * 10 requests per 60 seconds per IP
 */
export const captureLeadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "ratelimit:capture-lead",
});

/**
 * Rate limiter for /api/update-lead
 * 10 requests per 60 seconds per IP
 */
export const updateLeadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "ratelimit:update-lead",
});

/**
 * Rate limiter for /api/contestant-claim
 * 5 requests per 60 seconds per IP
 */
export const contestantClaimLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "ratelimit:contestant-claim",
});

/**
 * Rate limiter for /api/stage-waiver
 * 5 requests per 60 seconds per IP
 */
export const stageWaiverLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "ratelimit:stage-waiver",
});

export function getClientIp(request: Request): string {
  for (const header of [
    "cf-connecting-ip",
    "x-real-ip",
    "x-vercel-forwarded-for",
  ]) {
    const ip = normalizeIp(request.headers.get(header));
    if (ip) return ip;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIps = forwardedFor
    ?.split(",")
    .map((value) => normalizeIp(value))
    .filter((value): value is string => Boolean(value));
  const nearestProxyIp = forwardedIps?.at(-1);
  if (nearestProxyIp) return nearestProxyIp;

  return "unknown";
}

function normalizeIp(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 80 || trimmed.includes(",")) return null;
  if (!/^[a-fA-F0-9:.]+$/.test(trimmed)) return null;
  return trimmed;
}

function shouldFailOpenOnLimiterError(): boolean {
  return (
    import.meta.env.RATE_LIMIT_FAIL_OPEN === "true" || !import.meta.env.PROD
  );
}

/**
 * Shared rate limit check. Returns a 429 Response if the limit is exceeded,
 * or null if the request is allowed.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  ip: string,
): Promise<Response | null> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(ip);
    if (!success) {
      return new Response(
        JSON.stringify({ error: API_MESSAGES.RATE_LIMIT_EXCEEDED }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Retry-After": String(
              Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
            ),
          },
        },
      );
    }
    return null;
  } catch (error) {
    console.error("Rate limit check failed", error);
    if (shouldFailOpenOnLimiterError()) return null;

    return new Response(
      JSON.stringify({ error: API_MESSAGES.RATE_LIMIT_EXCEEDED }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      },
    );
  }
}
