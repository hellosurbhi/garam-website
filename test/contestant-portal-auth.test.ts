import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  contestantPortalLimiter: {},
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

const { POST } = await import("@/pages/api/contestant-portal-auth");

const TEST_SALT = "test-secret-salt-12345";

function computeSig(salt: string, date: string): string {
  return createHmac("sha256", salt).update(date).digest("hex");
}

function computeToken(salt: string, date: string): string {
  return createHmac("sha256", salt).update(`token-${date}`).digest("hex");
}

function getShowExpiryMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const offsetHours = m >= 4 && m <= 10 ? 4 : 5;
  return Date.UTC(y, m - 1, d + 1, offsetHours, 0, 0);
}

function makeRequest(body: unknown): Request {
  return new Request(
    "https://garammasaladating.com/api/contestant-portal-auth",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

describe("contestant-portal-auth handler", () => {
  beforeEach(() => {
    import.meta.env.CONTESTANT_PREP_SALT = TEST_SALT;
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete import.meta.env.CONTESTANT_PREP_SALT;
  });

  it("returns 500 when salt env var is missing", async () => {
    delete import.meta.env.CONTESTANT_PREP_SALT;
    const res = await POST(
      makeContext(makeRequest({ date: "2026-06-15", sig: "abc" })),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server misconfigured");
  });

  it("returns 400 when date is missing", async () => {
    const res = await POST(makeContext(makeRequest({ sig: "abc" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sig is missing", async () => {
    const res = await POST(makeContext(makeRequest({ date: "2026-06-15" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty", async () => {
    const res = await POST(makeContext(makeRequest({})));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 for invalid date format (no dashes)", async () => {
    const res = await POST(
      makeContext(
        makeRequest({
          date: "20260615",
          sig: computeSig(TEST_SALT, "20260615"),
        }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 for invalid date format (slash-separated)", async () => {
    const res = await POST(
      makeContext(
        makeRequest({
          date: "2026/06/15",
          sig: computeSig(TEST_SALT, "2026/06/15"),
        }),
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for short date format (MMM DD)", async () => {
    const res = await POST(
      makeContext(
        makeRequest({
          date: "Feb 22",
          sig: computeSig(TEST_SALT, "Feb 22"),
        }),
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 for wrong signature", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    const res = await POST(
      makeContext(makeRequest({ date: "2026-06-15", sig: "a".repeat(64) })),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid link");
  });

  it("returns 401 for correct sig with wrong salt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    const wrongSig = computeSig("wrong-salt", "2026-06-15");
    const res = await POST(
      makeContext(makeRequest({ date: "2026-06-15", sig: wrongSig })),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when link has expired (past midnight ET)", async () => {
    const date = "2026-06-14";
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry + 1000));
    const sig = computeSig(TEST_SALT, date);
    const res = await POST(makeContext(makeRequest({ date, sig })));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Link expired");
  });

  it("returns 200 with token and expiresAt for valid request before expiry", async () => {
    const date = "2026-06-15";
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 3600_000));
    const sig = computeSig(TEST_SALT, date);
    const res = await POST(makeContext(makeRequest({ date, sig })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    expect(body.token).toBe(computeToken(TEST_SALT, date));
    expect(body.expiresAt).toBe(expiry);
  });

  it("uses EDT offset (4h) for summer dates (April–October)", async () => {
    const date = "2026-08-20";
    const expiry = getShowExpiryMs(date);
    expect(expiry).toBe(Date.UTC(2026, 7, 21, 4, 0, 0));

    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 1));
    const sig = computeSig(TEST_SALT, date);
    const res = await POST(makeContext(makeRequest({ date, sig })));
    expect(res.status).toBe(200);
  });

  it("uses EST offset (5h) for winter dates (November–March)", async () => {
    const date = "2026-01-15";
    const expiry = getShowExpiryMs(date);
    expect(expiry).toBe(Date.UTC(2026, 0, 16, 5, 0, 0));

    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 1));
    const sig = computeSig(TEST_SALT, date);
    const res = await POST(makeContext(makeRequest({ date, sig })));
    expect(res.status).toBe(200);
  });

  it("uses EDT offset for April (boundary month)", () => {
    const date = "2026-04-01";
    const expiry = getShowExpiryMs(date);
    expect(expiry).toBe(Date.UTC(2026, 3, 2, 4, 0, 0));
  });

  it("uses EST offset for November (boundary month)", () => {
    const date = "2026-11-01";
    const expiry = getShowExpiryMs(date);
    expect(expiry).toBe(Date.UTC(2026, 10, 2, 5, 0, 0));
  });

  it("returns 401 at exactly the expiry moment", async () => {
    const date = "2026-06-15";
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry));
    const sig = computeSig(TEST_SALT, date);
    const res = await POST(makeContext(makeRequest({ date, sig })));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Link expired");
  });

  it("returns 200 one millisecond before expiry", async () => {
    const date = "2026-06-15";
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 1));
    const sig = computeSig(TEST_SALT, date);
    const res = await POST(makeContext(makeRequest({ date, sig })));
    expect(res.status).toBe(200);
  });

  it("rejects sig with invalid length (fails schema validation)", async () => {
    const res = await POST(
      makeContext(makeRequest({ date: "2026-06-15", sig: "abc123" })),
    );
    expect(res.status).toBe(400);
  });
});
