import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const ratelimitCtor = vi.fn();
  const redisCtor = vi.fn();

  class RatelimitMock {
    limit = limit;
    constructor(config: unknown) {
      ratelimitCtor(config);
    }
    static slidingWindow = vi.fn(() => "sliding-window");
  }

  class RedisMock {
    constructor(config: unknown) {
      redisCtor(config);
    }
  }

  return {
    limit,
    ratelimitCtor,
    redisCtor,
    Ratelimit: RatelimitMock,
    Redis: RedisMock,
  };
});

vi.mock("@upstash/ratelimit", () => ({ Ratelimit: mocks.Ratelimit }));
vi.mock("@upstash/redis", () => ({ Redis: mocks.Redis }));

const { enforceRateLimit, getClientIp, resetRateLimiters, RATE_LIMITS } =
  await import("@/lib/rateLimit");

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://garammasaladating.com/api/capture-lead", {
    method: "POST",
    headers,
  });
}

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimiters();
    delete import.meta.env.UPSTASH_REDIS_REST_URL;
    delete import.meta.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("fails open without constructing Redis when env vars are absent", async () => {
    const result = await enforceRateLimit(
      makeRequest(),
      RATE_LIMITS.captureLead,
    );
    expect(result).toBeNull();
    expect(mocks.redisCtor).not.toHaveBeenCalled();
    expect(mocks.ratelimitCtor).not.toHaveBeenCalled();
  });

  it("fails open when only one env var is set", async () => {
    import.meta.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    const result = await enforceRateLimit(
      makeRequest(),
      RATE_LIMITS.captureLead,
    );
    expect(result).toBeNull();
    expect(mocks.redisCtor).not.toHaveBeenCalled();
  });

  it("returns null when the limiter allows the request", async () => {
    import.meta.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    import.meta.env.UPSTASH_REDIS_REST_TOKEN = "token";
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    });

    const result = await enforceRateLimit(
      makeRequest({ "x-real-ip": "1.2.3.4" }),
      RATE_LIMITS.captureLead,
    );
    expect(result).toBeNull();
    expect(mocks.limit).toHaveBeenCalledWith("1.2.3.4");
  });

  it("returns 429 with rate limit headers when over budget", async () => {
    import.meta.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    import.meta.env.UPSTASH_REDIS_REST_TOKEN = "token";
    mocks.limit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const result = await enforceRateLimit(
      makeRequest(),
      RATE_LIMITS.captureLead,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    expect(result?.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(result?.headers.get("X-RateLimit-Remaining")).toBe("0");
    const retryAfter = Number(result?.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(30);
    const body = (await result?.json()) as { error: string };
    expect(body.error).toBe("Too many requests. Please try again later.");
  });

  it("fails open when the limiter throws at runtime", async () => {
    import.meta.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    import.meta.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.limit.mockRejectedValue(new Error("redis unreachable"));

    const result = await enforceRateLimit(
      makeRequest(),
      RATE_LIMITS.captureLead,
    );
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("reuses one limiter instance per policy prefix", async () => {
    import.meta.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    import.meta.env.UPSTASH_REDIS_REST_TOKEN = "token";
    mocks.limit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    });

    await enforceRateLimit(makeRequest(), RATE_LIMITS.captureLead);
    await enforceRateLimit(makeRequest(), RATE_LIMITS.captureLead);
    await enforceRateLimit(makeRequest(), RATE_LIMITS.updateLead);
    expect(mocks.ratelimitCtor).toHaveBeenCalledTimes(2);
  });
});

describe("getClientIp", () => {
  it("prefers cf-connecting-ip, then x-real-ip", () => {
    expect(
      getClientIp(
        makeRequest({ "cf-connecting-ip": "9.9.9.9", "x-real-ip": "1.2.3.4" }),
      ),
    ).toBe("9.9.9.9");
    expect(getClientIp(makeRequest({ "x-real-ip": "1.2.3.4" }))).toBe(
      "1.2.3.4",
    );
  });

  it("falls back to the last hop of x-forwarded-for", () => {
    expect(
      getClientIp(makeRequest({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" })),
    ).toBe("7.7.7.7");
  });

  it("rejects malformed header values", () => {
    expect(getClientIp(makeRequest({ "x-real-ip": "not an ip!" }))).toBe(
      "unknown",
    );
    expect(getClientIp(makeRequest())).toBe("unknown");
  });

  it("accepts IPv6 addresses", () => {
    expect(getClientIp(makeRequest({ "x-real-ip": "2001:db8::1" }))).toBe(
      "2001:db8::1",
    );
  });
});
