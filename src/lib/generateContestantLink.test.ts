import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockVerifyAdminToken = vi.fn();

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken: (...args: unknown[]) => mockVerifyAdminToken(...args),
}));

const { POST } = await import("@/pages/api/generate-contestant-link");

const TEST_SALT = "test-secret-salt";

function makeRequest(
  method: string,
  body: unknown = {},
  headers: Record<string, string> = { authorization: "Bearer test-token" },
): Request {
  return new Request(
    "https://garammasaladating.com/api/generate-contestant-link",
    {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: method !== "GET" ? JSON.stringify(body) : undefined,
    },
  );
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

describe("generate-contestant-link handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.CONTESTANT_PREP_SALT = TEST_SALT;
    mockVerifyAdminToken.mockResolvedValue("admin-uid");
  });

  afterEach(() => {
    delete import.meta.env.CONTESTANT_PREP_SALT;
    vi.unstubAllEnvs();
  });

  it("returns 401 when not authenticated", async () => {
    mockVerifyAdminToken.mockResolvedValue(null);
    const req = makeRequest("POST", { showDate: "2026-06-15" });
    const res = await POST(makeContext(req));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication required");
  });

  it("returns 500 when salt env var is missing", async () => {
    delete import.meta.env.CONTESTANT_PREP_SALT;
    const req = makeRequest("POST", { showDate: "2026-06-15" });
    const res = await POST(makeContext(req));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server misconfigured");
  });

  it("returns 400 when showDate is missing", async () => {
    const req = makeRequest("POST", {});
    const res = await POST(makeContext(req));
    expect(res.status).toBe(400);
  });

  it("returns 400 when showDate has invalid format", async () => {
    const req = makeRequest("POST", { showDate: "June 15" });
    const res = await POST(makeContext(req));
    expect(res.status).toBe(400);
  });

  it("returns 200 with URL for valid request", async () => {
    const req = makeRequest(
      "POST",
      { showDate: "2026-06-15" },
      { authorization: "Bearer test-token", host: "garammasaladating.com" },
    );
    const res = await POST(makeContext(req));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("contestant-prep");
    expect(body.url).toContain("date=2026-06-15");
    expect(body.url).toContain("sig=");
  });

  it("uses fallback origin when SITE env var is not set", async () => {
    delete (import.meta.env as Record<string, unknown>).SITE;
    const req = makeRequest(
      "POST",
      { showDate: "2026-06-15" },
      { authorization: "Bearer test-token", host: "garammasaladating.com" },
    );
    const res = await POST(makeContext(req));
    const body = await res.json();
    expect(body.url).toMatch(/^https:\/\/garammasaladating\.com\//);
  });

  it("url uses origin from SITE env var", async () => {
    vi.stubEnv("SITE", "https://custom-origin.example.com");
    const req = makeRequest(
      "POST",
      { showDate: "2026-06-15" },
      { authorization: "Bearer test-token", host: "localhost:3000" },
    );
    const res = await POST(makeContext(req));
    const body = await res.json();
    expect(body.url).toMatch(/^https:\/\/custom-origin\.example\.com\//);
  });
});
