import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { readTrimmedEnv } from "@/lib/env";
import { jsonResponse } from "@/lib/http";
import { API_MESSAGES } from "@/lib/messages";

export interface RateLimitPolicy {
  prefix: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  captureLead: {
    prefix: "ratelimit:capture-lead",
    limit: 10,
    windowSeconds: 60,
  },
  updateLead: {
    prefix: "ratelimit:update-lead",
    limit: 10,
    windowSeconds: 60,
  },
  notifyApplication: {
    prefix: "ratelimit:notify-application",
    limit: 5,
    windowSeconds: 60,
  },
  contestantPrepAuth: {
    prefix: "ratelimit:contestant-prep-auth",
    limit: 5,
    windowSeconds: 60,
  },
  verifyTurnstile: {
    prefix: "ratelimit:verify-turnstile",
    limit: 20,
    windowSeconds: 60,
  },
  syncOrders: {
    prefix: "ratelimit:sync-orders",
    limit: 5,
    windowSeconds: 60,
  },
  syncLeadsToKit: {
    prefix: "ratelimit:sync-leads-to-kit",
    limit: 5,
    windowSeconds: 60,
  },
  stageWaiver: {
    prefix: "ratelimit:stage-waiver",
    limit: 5,
    windowSeconds: 60,
  },
  contestantClaim: {
    prefix: "ratelimit:contestant-claim",
    limit: 5,
    windowSeconds: 60,
  },
} as const satisfies Record<string, RateLimitPolicy>;

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

// One Ratelimit instance per policy prefix, created on first use and reused
// for the lifetime of the warm lambda. Env is read on every call so the
// feature toggles without a deploy and tests can mutate import.meta.env
// between cases. Nothing here may run at module scope: a Redis client
// constructed with missing env produces a client that throws on first use,
// which is how the earlier version of this file turned an unset env var
// into request-time failures.
const limiters = new Map<string, Ratelimit>();

/** Test hook: drop cached limiter instances so env changes take effect. */
export function resetRateLimiters(): void {
  limiters.clear();
}

function getLimiter(policy: RateLimitPolicy): Ratelimit | null {
  const url = readTrimmedEnv(import.meta.env.UPSTASH_REDIS_REST_URL);
  const token = readTrimmedEnv(import.meta.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) return null;

  const cached = limiters.get(policy.prefix);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSeconds} s`),
    prefix: policy.prefix,
  });
  limiters.set(policy.prefix, limiter);
  return limiter;
}

/**
 * Per-IP rate limit guard for API routes. Returns a 429 Response when the
 * caller is over budget, or null when the request may proceed.
 *
 * Fails open by design: when the Upstash env vars are absent (feature is
 * opt-in, same pattern as Turnstile) or Redis errors at runtime, lead
 * capture and application submission must keep working.
 */
export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
): Promise<Response | null> {
  const limiter = getLimiter(policy);
  if (!limiter) return null;

  try {
    const { success, limit, remaining, reset } = await limiter.limit(
      getClientIp(request),
    );
    if (success) return null;

    return jsonResponse({ error: API_MESSAGES.RATE_LIMIT_EXCEEDED }, 429, {
      "Retry-After": String(
        Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
      ),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(reset),
    });
  } catch (error) {
    console.error("[rateLimit] limiter error, failing open:", error);
    return null;
  }
}
