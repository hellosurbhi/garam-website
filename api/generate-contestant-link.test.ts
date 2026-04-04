import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockVerifyIdToken = vi.fn();

vi.mock("./_verify-token", () => ({
  verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
}));

const { default: handler } = await import("./generate-contestant-link");

const TEST_SALT = "test-secret-salt";

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

function makeReq(
  method: string,
  body: unknown = {},
  headers: Record<string, string> = {},
): VercelRequest {
  return { method, body, headers } as unknown as VercelRequest;
}

describe("generate-contestant-link handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTESTANT_PREP_SALT = TEST_SALT;
    mockVerifyIdToken.mockResolvedValue("admin-uid");
  });

  afterEach(() => {
    delete process.env.CONTESTANT_PREP_SALT;
  });

  it("returns 405 for non-POST methods", async () => {
    const req = makeReq("GET");
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("sets Allow header on 405 response", async () => {
    const req = makeReq("PUT");
    const res = makeRes();
    await handler(req, res);
    expect(res._headers["Allow"]).toBe("POST");
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyIdToken.mockResolvedValue(null);
    const req = makeReq("POST", { showDate: "2026-06-15" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: string }).error).toBe("Authentication required");
  });

  it("returns 500 when salt env var is missing", async () => {
    delete process.env.CONTESTANT_PREP_SALT;
    const req = makeReq("POST", { showDate: "2026-06-15" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe("Server misconfigured");
  });

  it("returns 400 when showDate is missing", async () => {
    const req = makeReq("POST", {});
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when showDate has invalid format", async () => {
    const req = makeReq("POST", { showDate: "June 15" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with URL for valid request", async () => {
    const req = makeReq("POST", { showDate: "2026-06-15" }, { host: "garammasaladating.com" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { url: string };
    expect(body.url).toContain("contestant-prep");
    expect(body.url).toContain("date=2026-06-15");
    expect(body.url).toContain("sig=");
  });

  it("uses https for non-localhost hosts", async () => {
    const req = makeReq("POST", { showDate: "2026-06-15" }, { host: "garammasaladating.com" });
    const res = makeRes();
    await handler(req, res);
    expect((res.body as { url: string }).url).toMatch(/^https:\/\//);
  });

  it("uses http for localhost", async () => {
    const req = makeReq("POST", { showDate: "2026-06-15" }, { host: "localhost:3000" });
    const res = makeRes();
    await handler(req, res);
    expect((res.body as { url: string }).url).toMatch(/^http:\/\//);
  });

  it("uses http for 127.0.0.1", async () => {
    const req = makeReq("POST", { showDate: "2026-06-15" }, { host: "127.0.0.1:3000" });
    const res = makeRes();
    await handler(req, res);
    expect((res.body as { url: string }).url).toMatch(/^http:\/\//);
  });
});
