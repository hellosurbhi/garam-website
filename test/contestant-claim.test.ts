import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    fsGet: vi.fn(),
    fsAdd: vi.fn(),
    fsPatch: vi.fn(),
    enforceRateLimit: vi.fn(),
    signPortalToken: vi.fn(),
    midnightLocalUnix: vi.fn(),
    sendMail: vi.fn(),
    cleanPhone: vi.fn(),
    waiverReceiptWithText: vi.fn(),
    getClientIp: vi.fn(),
  };
});

vi.mock("@/lib/firestoreRest", () => ({
  fsGet: mocks.fsGet,
  fsAdd: mocks.fsAdd,
  fsPatch: mocks.fsPatch,
}));
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
  WAIVER_TEXT: "Waiver text here.",
}));

const { POST } = await import("@/pages/api/contestant-claim");

const VALID_BODY = {
  inviteId: "inv-123",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "+12125550100",
  waiverAgreed: true,
  signature: "Jane Doe",
  waiverVersion: "v1",
  mailingListOptIn: false,
};

const FUTURE_INVITE = {
  claimed: false,
  showDate: "2099-12-31",
  showTimezone: "America/New_York",
  role: "female",
  showId: "nyc-2099-12-31",
  showCity: "New York",
};

function makeRequest(body: Record<string, unknown> = VALID_BODY): Request {
  return new Request("https://garammasaladating.com/api/contestant-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("contestant-claim POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.cleanPhone.mockReturnValue("+12125550100");
    mocks.fsGet.mockResolvedValue(FUTURE_INVITE);
    mocks.fsAdd.mockResolvedValue("contestant-id-1");
    mocks.signPortalToken.mockResolvedValue("signed-jwt");
    mocks.midnightLocalUnix.mockReturnValue(
      Math.floor(Date.now() / 1000) + 86400,
    );
    mocks.sendMail.mockResolvedValue(undefined);
    mocks.waiverReceiptWithText.mockReturnValue({
      subject: "Your waiver",
      text: "plain text",
      html: "<p>html</p>",
    });
    mocks.getClientIp.mockReturnValue("1.2.3.4");
  });

  it("passes through rate limit response when limited", async () => {
    const limitResp = new Response("Too many requests", { status: 429 });
    mocks.enforceRateLimit.mockResolvedValue(limitResp);
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
    const body = await res.json();
    expect(body.error).toMatch(/waiver/i);
  });

  it("returns 400 when waiverVersion mismatches", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, waiverVersion: "v99" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/version/i);
  });

  it("returns 400 when signature does not match full name", async () => {
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, signature: "J. Doe" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("returns 400 when phone number is invalid", async () => {
    mocks.cleanPhone.mockReturnValue(null);
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/phone/i);
  });

  it("returns 404 when invite does not exist", async () => {
    mocks.fsGet.mockResolvedValue(null);
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/invalid invite/i);
  });

  it("returns 409 when invite is already claimed", async () => {
    mocks.fsGet.mockResolvedValue({ ...FUTURE_INVITE, claimed: true });
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already been used/i);
  });

  it("returns 410 when show has already passed", async () => {
    mocks.fsGet.mockResolvedValue({
      ...FUTURE_INVITE,
      showDate: "2000-01-01",
    });
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/passed/i);
  });

  it("creates contestant doc and sets portal_session cookie on success", async () => {
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "contestants",
      expect.objectContaining({
        inviteId: "inv-123",
        firstName: "Jane",
        email: "jane@example.com",
        waiverVersion: "v1",
      }),
    );
    expect(mocks.fsPatch).toHaveBeenCalledWith(
      "invites/inv-123",
      expect.objectContaining({ claimed: true }),
    );
    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).toMatch(/portal_session=signed-jwt/);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("still returns 200 even when email send throws", async () => {
    mocks.sendMail.mockRejectedValue(new Error("SMTP error"));
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
  });

});
