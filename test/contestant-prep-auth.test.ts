import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const { default: handler } = await import("../api/contestant-prep-auth");

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

function makeRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },
  };
  return res as unknown as VercelResponse & {
    statusCode: number;
    body: unknown;
    _headers: Record<string, string>;
  };
}

function makeReq(method: string, body: unknown = {}): VercelRequest {
  return { method, body } as VercelRequest;
}

describe("contestant-prep-auth handler", () => {
  beforeEach(() => {
    process.env.CONTESTANT_PREP_SALT = TEST_SALT;
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CONTESTANT_PREP_SALT;
  });

  it("returns 405 for non-POST methods", () => {
    const req = makeReq("GET");
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(405);
    expect((res.body as { error: string }).error).toBe("Method not allowed");
  });

  it("sets Allow header on 405 response", () => {
    const req = makeReq("PUT");
    const res = makeRes();
    handler(req, res);
    expect(res._headers["Allow"]).toBe("POST");
  });

  it("returns 500 when salt env var is missing", () => {
    delete process.env.CONTESTANT_PREP_SALT;
    const req = makeReq("POST", { date: "2026-06-15", sig: "abc" });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe("Server misconfigured");
  });

  it("returns 400 when date is missing", () => {
    const req = makeReq("POST", { sig: "abc" });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when sig is missing", () => {
    const req = makeReq("POST", { date: "2026-06-15" });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when body is empty", () => {
    const req = makeReq("POST", {});
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe(
      "date and sig are required"
    );
  });

  it("returns 400 for invalid date format (no dashes)", () => {
    const req = makeReq("POST", {
      date: "20260615",
      sig: computeSig(TEST_SALT, "20260615"),
    });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe("Invalid date format");
  });

  it("returns 400 for invalid date format (slash-separated)", () => {
    const req = makeReq("POST", {
      date: "2026/06/15",
      sig: computeSig(TEST_SALT, "2026/06/15"),
    });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for short date format (MMM DD)", () => {
    const req = makeReq("POST", {
      date: "Feb 22",
      sig: computeSig(TEST_SALT, "Feb 22"),
    });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for wrong signature", () => {
    const date = "2026-06-15";
    // Set time well before expiry
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    const req = makeReq("POST", { date, sig: "a".repeat(64) });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: string }).error).toBe("Invalid link");
  });

  it("returns 401 for correct sig with wrong salt", () => {
    const date = "2026-06-15";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    const wrongSig = computeSig("wrong-salt", date);
    const req = makeReq("POST", { date, sig: wrongSig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when link has expired (past midnight ET)", () => {
    const date = "2026-06-14"; // Summer: EDT offset 4h
    // Expiry = Date.UTC(2026, 5, 15, 4, 0, 0) = 2026-06-15T04:00:00Z
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry + 1000)); // 1 second after expiry
    const sig = computeSig(TEST_SALT, date);
    const req = makeReq("POST", { date, sig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: string }).error).toBe("Link expired");
  });

  it("returns 200 with token and expiresAt for valid request before expiry", () => {
    const date = "2026-06-15";
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 3600_000)); // 1 hour before expiry
    const sig = computeSig(TEST_SALT, date);
    const req = makeReq("POST", { date, sig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { token: string; expiresAt: number };
    expect(typeof body.token).toBe("string");
    expect(body.token).toBe(computeToken(TEST_SALT, date));
    expect(body.expiresAt).toBe(expiry);
  });

  it("uses EDT offset (4h) for summer dates (April–October)", () => {
    const date = "2026-08-20"; // August → EDT
    const expiry = getShowExpiryMs(date);
    // Expiry = Date.UTC(2026, 7, 21, 4, 0, 0)
    expect(expiry).toBe(Date.UTC(2026, 7, 21, 4, 0, 0));

    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 1)); // just before expiry
    const sig = computeSig(TEST_SALT, date);
    const req = makeReq("POST", { date, sig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("uses EST offset (5h) for winter dates (November–March)", () => {
    const date = "2026-01-15"; // January → EST
    const expiry = getShowExpiryMs(date);
    // Expiry = Date.UTC(2026, 0, 16, 5, 0, 0)
    expect(expiry).toBe(Date.UTC(2026, 0, 16, 5, 0, 0));

    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 1));
    const sig = computeSig(TEST_SALT, date);
    const req = makeReq("POST", { date, sig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("uses EST offset (5h) for April (boundary month, included in EDT)", () => {
    const date = "2026-04-01"; // April → EDT (m=4, included)
    const expiry = getShowExpiryMs(date);
    expect(expiry).toBe(Date.UTC(2026, 3, 2, 4, 0, 0)); // offset=4
  });

  it("uses EST offset for November (boundary month, included in EST)", () => {
    const date = "2026-11-01"; // November → EST (m=11, not in 4-10)
    const expiry = getShowExpiryMs(date);
    expect(expiry).toBe(Date.UTC(2026, 10, 2, 5, 0, 0)); // offset=5
  });

  it("returns 401 at exactly the expiry moment", () => {
    const date = "2026-06-15";
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry)); // exactly at expiry
    const sig = computeSig(TEST_SALT, date);
    const req = makeReq("POST", { date, sig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: string }).error).toBe("Link expired");
  });

  it("returns 200 one millisecond before expiry", () => {
    const date = "2026-06-15";
    const expiry = getShowExpiryMs(date);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiry - 1));
    const sig = computeSig(TEST_SALT, date);
    const req = makeReq("POST", { date, sig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("rejects sig with different length (timing-safe check)", () => {
    const date = "2026-06-15";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    // A sig that is shorter than expected (64 hex chars)
    const shortSig = "abc123";
    const req = makeReq("POST", { date, sig: shortSig });
    const res = makeRes();
    handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});