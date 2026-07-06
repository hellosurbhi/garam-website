import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fsAdd: vi.fn(),
  enforceRateLimit: vi.fn(),
  signPortalToken: vi.fn(),
  midnightLocalUnix: vi.fn(),
  sendMail: vi.fn(),
  cleanPhone: vi.fn(),
  waiverReceiptWithText: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/firestoreRest", () => ({ fsAdd: mocks.fsAdd }));
vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  RATE_LIMITS: { contestantClaim: {} },
  getClientIp: mocks.getClientIp,
}));
vi.mock("@/lib/portalToken", () => ({
  signPortalToken: mocks.signPortalToken,
  _midnightLocalUnix: mocks.midnightLocalUnix,
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/lib/phone", () => ({ cleanPhone: mocks.cleanPhone }));
vi.mock("@/data/emails", () => ({
  waiverReceiptWithText: mocks.waiverReceiptWithText,
}));
vi.mock("@/data/waiver", () => ({
  WAIVER_VERSION: "v1",
  WAIVER_TEXT: "Waiver text.",
}));
vi.mock("@/data/events", () => ({
  events: [
    {
      hidden: false,
      citySlug: "nyc",
      isoDate: "2099-12-31",
      city: "New York",
      date: "December 31, 2099",
      startTime: "20:00",
      timezone: "America/New_York",
      venue: { name: "Test Venue", streetAddress: "123 Main St" },
    },
    {
      hidden: false,
      citySlug: "nyc",
      isoDate: "2000-01-01",
      city: "New York",
      date: "January 1, 2000",
      startTime: "20:00",
      timezone: "America/New_York",
      venue: { name: "Past Venue", streetAddress: "123 Main St" },
    },
  ],
}));

const { POST } = await import("@/pages/api/contestant-show-claim");

const VALID_BODY = {
  showId: "nyc-2099-12-31",
  role: "female",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "+12125550100",
  waiverAgreed: true,
  signature: "Jane Doe",
  waiverVersion: "v1",
  mailingListOptIn: false,
};

function makeRequest(body: Record<string, unknown> = VALID_BODY): Request {
  return new Request(
    "https://garammasaladating.com/api/contestant-show-claim",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("contestant-show-claim POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.cleanPhone.mockReturnValue("+12125550100");
    mocks.fsAdd.mockResolvedValue("show-contestant-id");
    mocks.signPortalToken.mockResolvedValue("show-jwt");
    mocks.midnightLocalUnix.mockReturnValue(
      Math.floor(Date.now() / 1000) + 86400,
    );
    mocks.sendMail.mockResolvedValue(undefined);
    mocks.waiverReceiptWithText.mockReturnValue({
      subject: "Your waiver",
      text: "plain",
      html: "<p>html</p>",
    });
    mocks.getClientIp.mockReturnValue("1.2.3.4");
  });

  it("passes through rate limit response", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      new Response("Too many requests", { status: 429 }),
    );
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(429);
  });

  it("returns 400 when waiverAgreed is false", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, waiverAgreed: false }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("returns 400 for spectator role", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, role: "spectator" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/spectator/i);
  });

  it("returns 400 when waiverVersion mismatches", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, waiverVersion: "v99" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature does not match full name", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, signature: "Wrong Name" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("returns 400 when phone is invalid", async () => {
    mocks.cleanPhone.mockReturnValue(null);
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown showId", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, showId: "unknown-2099-12-31" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/invalid show/i);
  });

  it("returns 410 when show has already passed", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, showId: "nyc-2000-01-01" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(410);
  });

  it("creates contestant doc and sets portal_session cookie on success", async () => {
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "contestants",
      expect.objectContaining({
        firstName: "Jane",
        showId: "nyc-2099-12-31",
        showCity: "New York",
        inviteId: null,
      }),
    );
    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).toMatch(/portal_session=show-jwt/);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("still returns 200 when email send throws", async () => {
    mocks.sendMail.mockRejectedValue(new Error("SMTP error"));
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
  });
});
