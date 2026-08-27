import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { readTrimmedEnv } from "@/lib/env";
import { jsonResponse } from "@/lib/http";
import { API_MESSAGES } from "@/lib/messages";
import { withTimeout } from "@/utils/withTimeout";

// WHY a hard ceiling on the Redis round-trip: enforceRateLimit's catch block
// only fails open on a *thrown* error, not a *hanging* one. Every route that
// calls this synchronously (all of them except the backgrounded
// src/pages/api/go/[slug].ts) would otherwise have no bound on how long a
// slow Upstash response could hold up its own response. 1.5s comfortably
// covers a normal Upstash REST call (typically well under 100ms) while
// staying short enough that even a synchronous caller's visitor barely
// notices a worst case.
const REDIS_TIMEOUT_MS = 1500;

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
  alertFailure: {
    prefix: "ratelimit:alert-failure",
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
  goRedirect: {
    prefix: "ratelimit:go-redirect",
    // Every real "Get Tickets" click hits this route, including link-preview
    // bots (Meta/iMessage/Slack unfurl the ad URL headlessly) and shared-IP
    // bursts (a group behind one office/campus NAT clicking the same link).
    // Kept generous so a viral moment never throttles a real ticket buyer.
    limit: 30,
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
  // WHY getLimiter() is called inside the try, not before it (caught by
  // Codex review, 2026-08-27): the Redis/Ratelimit constructors it calls can
  // themselves throw (e.g. a malformed UPSTASH_REDIS_REST_URL), and every
  // caller of this function (11 routes, none of which wrap the call in their
  // own try/catch) trusts this function's documented fail-open contract.
  // Outside the try, that constructor throw would reject this function's
  // promise instead of resolving to null, turning a bad env value into a
  // 500 on every rate-limited route instead of the intended no-op.
  try {
    const limiter = getLimiter(policy);
    if (!limiter) return null;

    const { success, limit, remaining, reset } = await withTimeout(
      limiter.limit(getClientIp(request)),
      REDIS_TIMEOUT_MS,
      "Upstash rate limit check",
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
