import { beforeEach, describe, expect, it, vi } from "vitest";
import { WAIVER_VERSION } from "@/data/waiver";

const mocks = vi.hoisted(() => ({
  fsAdd: vi.fn(),
  sendMail: vi.fn(),
  waitUntil: vi.fn(),
  alertOps: vi.fn(),
}));
vi.mock("@/lib/firestoreRest", () => ({ fsAdd: mocks.fsAdd }));
vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: () => "127.0.0.1",
  RATE_LIMITS: { stageWaiver: {} },
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));
vi.mock("@vercel/functions", () => ({ waitUntil: mocks.waitUntil }));

const { POST } = await import("@/pages/api/stage-waiver");
function request() {
  return new Request("https://example.com/api/stage-waiver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "+12125550100",
      signature: "Jane Doe",
      waiverAgreed: true,
      waiverVersion: WAIVER_VERSION,
      mailingListOptIn: false,
    }),
  });
}

describe("standalone waiver persistence and receipt", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fsAdd.mockResolvedValue("waiver-id");
  });
  it("confirms a saved waiver before its email settles and reports failed delivery", async () => {
    let rejectMail!: (error: Error) => void;
    mocks.sendMail.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectMail = reject;
      }),
    );
    const response = await POST({ request: request() } as Parameters<
      typeof POST
    >[0]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "stage_waivers",
      expect.objectContaining({ email: "jane@example.com" }),
    );
    expect(mocks.waitUntil).toHaveBeenCalledOnce();
    rejectMail(new Error("SMTP unavailable"));
    await mocks.waitUntil.mock.calls[0][0];
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({ flow: "waiver", stage: "receipt_email" }),
    );
  });
  it("does not send a receipt or return success when persistence fails", async () => {
    mocks.fsAdd.mockRejectedValue(new Error("write failed"));
    const response = await POST({ request: request() } as Parameters<
      typeof POST
    >[0]);
    expect(response.status).toBe(500);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.waitUntil).not.toHaveBeenCalled();
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "firestore_write" }),
    );
  });
});
