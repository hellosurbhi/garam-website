import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    fsGet: vi.fn(),
    fsAdd: vi.fn(),
    fsPatch: vi.fn(),
    enforceRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    sendMail: vi.fn(),
    cleanPhone: vi.fn(),
    waiverReceipt: vi.fn(),
    producerWaiverNotification: vi.fn(),
    verifyPortalToken: vi.fn(),
    alertOps: vi.fn(),
  };
});

vi.mock("@/lib/firestoreRest", () => ({
  fsGet: mocks.fsGet,
  fsAdd: mocks.fsAdd,
  fsPatch: mocks.fsPatch,
}));
vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  RATE_LIMITS: { stageWaiver: {} },
  getClientIp: mocks.getClientIp,
}));
vi.mock("@/lib/portalToken", () => ({
  verifyPortalToken: mocks.verifyPortalToken,
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/lib/phone", () => ({ cleanPhone: mocks.cleanPhone }));
vi.mock("@/data/emails", () => ({
  waiverReceipt: mocks.waiverReceipt,
  producerWaiverNotification: mocks.producerWaiverNotification,
}));
vi.mock("@/data/waiver", () => ({
  WAIVER_VERSION: "v1",
  WAIVER_TEXT: "Waiver text here.",
}));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));

const { POST } = await import("@/pages/api/stage-waiver");

const VALID_BODY = {
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
  return new Request("https://garammasaladating.com/api/stage-waiver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("stage-waiver POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete import.meta.env.NOTIFICATION_EMAIL;
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.cleanPhone.mockReturnValue("+12125550100");
    mocks.fsAdd.mockResolvedValue("waiver-id-1");
    mocks.fsPatch.mockResolvedValue(undefined);
    mocks.sendMail.mockResolvedValue(undefined);
    mocks.waiverReceipt.mockReturnValue({
      subject: "Your waiver",
      text: "plain text",
      html: "<p>html</p>",
    });
    mocks.producerWaiverNotification.mockReturnValue({
      subject: "New waiver signed: Jane Doe",
      text: "producer plain text",
      html: "<p>producer html</p>",
    });
  });

  afterEach(() => {
    delete import.meta.env.NOTIFICATION_EMAIL;
  });

  it("passes through rate limit response when limited", async () => {
    const limitResp = new Response("Too many requests", { status: 429 });
    mocks.enforceRateLimit.mockResolvedValue(limitResp);
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(429);
    expect(mocks.fsAdd).not.toHaveBeenCalled();
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

  it("returns 401 when portalToken is invalid", async () => {
    mocks.verifyPortalToken.mockRejectedValue(new Error("bad token"));
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, portalToken: "bad-jwt" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns 401 when the invite behind portalToken has no applicantId", async () => {
    mocks.verifyPortalToken.mockResolvedValue({ contestantId: "c-1" });
    mocks.fsGet.mockResolvedValue({});
    const res = await POST({
      request: makeRequest({ ...VALID_BODY, portalToken: "good-jwt" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    expect(mocks.fsAdd).not.toHaveBeenCalled();
  });

  it("returns 500 and pages ops when the Firestore write fails", async () => {
    mocks.fsAdd.mockRejectedValueOnce(new Error("Firestore down"));
    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(500);
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({ flow: "waiver", stage: "firestore_write" }),
    );
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("saves the waiver, links the application, and sends only the signer receipt when NOTIFICATION_EMAIL is unset", async () => {
    mocks.verifyPortalToken.mockResolvedValue({ contestantId: "c-1" });
    mocks.fsGet.mockResolvedValue({ applicantId: "app-1" });

    const res = await POST({
      request: makeRequest({ ...VALID_BODY, portalToken: "good-jwt" }),
    } as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "stage_waivers",
      expect.objectContaining({ email: "jane@example.com" }),
    );
    expect(mocks.fsPatch).toHaveBeenCalledWith(
      "applications/app-1",
      expect.objectContaining({ waiverSignedAt: expect.any(String) }),
    );
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "applications/app-1/events",
      expect.objectContaining({ type: "waiver_signed" }),
    );

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com" }),
    );
    expect(mocks.producerWaiverNotification).not.toHaveBeenCalled();
  });

  it("sends both the signer receipt and a producer copy when NOTIFICATION_EMAIL is set", async () => {
    import.meta.env.NOTIFICATION_EMAIL = "producer@example.com";

    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com" }),
    );
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "producer@example.com" }),
    );
    expect(mocks.producerWaiverNotification).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+12125550100",
      flow: "Stage-only waiver",
    });
  });

  it("still returns 200 and pages ops when the signer receipt email rejects", async () => {
    mocks.sendMail.mockImplementation(({ to }: { to: string }) =>
      to === "jane@example.com"
        ? Promise.reject(new Error("SMTP error"))
        : Promise.resolve(undefined),
    );

    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "waiver",
        stage: "receipt_email",
        errorMessage: "SMTP error",
      }),
    );
  });

  it("still returns 200 and pages ops when the producer notification email rejects", async () => {
    import.meta.env.NOTIFICATION_EMAIL = "producer@example.com";
    mocks.sendMail.mockImplementation(({ to }: { to: string }) =>
      to === "producer@example.com"
        ? Promise.reject(new Error("SMTP error"))
        : Promise.resolve(undefined),
    );

    const res = await POST({
      request: makeRequest(),
    } as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "waiver",
        stage: "producer_notify_email",
        errorMessage: "SMTP error",
      }),
    );
  });
});
