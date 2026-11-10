import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fsGet: vi.fn(),
  fsListAll: vi.fn(),
  fsPatch: vi.fn(),
  sendMail: vi.fn(),
  alertOps: vi.fn(),
}));

vi.mock("@/lib/firestoreRest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/firestoreRest")>()),
  fsGet: mocks.fsGet,
  fsListAll: mocks.fsListAll,
  fsPatch: mocks.fsPatch,
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));

// WATCHED_ENV is read at import time, so the env is set first.
import.meta.env.CRON_SECRET = "cron-secret";
import.meta.env.NOTIFICATION_EMAIL = "owner@example.com";
const { GET } = await import("@/pages/api/cron/daily-digest");

function call(auth?: string) {
  const request = new Request(
    "https://garammasaladating.com/api/cron/daily-digest",
    {
      headers: auth ? { authorization: auth } : {},
    },
  );
  return GET({ request } as Parameters<typeof GET>[0]) as Promise<Response>;
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.fsGet.mockResolvedValue(null);
  mocks.fsListAll.mockResolvedValue([]);
  mocks.fsPatch.mockResolvedValue(undefined);
  mocks.sendMail.mockResolvedValue(undefined);
  import.meta.env.CRON_SECRET = "cron-secret";
  import.meta.env.NOTIFICATION_EMAIL = "owner@example.com";
});

describe("daily digest cron route", () => {
  it("401s without the bearer secret and does nothing", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.fsListAll).not.toHaveBeenCalled();
  });

  it("401s when CRON_SECRET is unset, so an open endpoint is impossible", async () => {
    delete import.meta.env.CRON_SECRET;
    expect((await call("Bearer undefined")).status).toBe(401);
  });

  it("sends one email then moves the cursor", async () => {
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({
      to: "owner@example.com",
      subject: "Garam daily: 0 signups, 0 applications, 0 problems",
    });
    expect(mocks.fsPatch).toHaveBeenCalledWith("systemConfig/digest", {
      lastSentAt: "2026-11-10T12:00:00.000Z",
      lastDateKey: "2026-11-10",
    });
  });

  it("does not send twice for the same New York date", async () => {
    mocks.fsGet.mockResolvedValue({
      lastDateKey: "2026-11-10",
      lastSentAt: "2026-11-10T12:00:00.000Z",
    });
    const res = await call("Bearer cron-secret");
    expect(await res.json()).toMatchObject({ skipped: "already sent" });
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.fsPatch).not.toHaveBeenCalled();
  });

  it("windows the digest from the last send, not a fixed 24h", async () => {
    mocks.fsGet.mockResolvedValue({
      lastDateKey: "2026-11-07",
      lastSentAt: "2026-11-07T12:00:00.000Z",
    });
    mocks.fsListAll.mockImplementation(async (col: string) =>
      col === "leads"
        ? [{ email: "missed@x.com", createdAt: "2026-11-08T15:00:00.000Z" }]
        : [],
    );
    await call("Bearer cron-secret");
    expect(mocks.sendMail.mock.calls[0][0].text).toContain("missed@x.com");
  });

  it("a failed send leaves the cursor alone so tomorrow covers the gap, and pages with the real error", async () => {
    mocks.sendMail.mockRejectedValue(new Error("535 Authentication failed"));
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(mocks.fsPatch).not.toHaveBeenCalled();
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "cron_daily_digest",
        errorMessage: "535 Authentication failed",
      }),
    );
  });

  it("a dead database login pages instead of sending an empty digest", async () => {
    mocks.fsGet.mockRejectedValue(
      new Error("invalid_grant: Invalid JWT Signature"),
    );
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.alertOps.mock.calls[0][0].errorMessage).toContain(
      "invalid_grant",
    );
  });

  it("a missing NOTIFICATION_EMAIL pages by name", async () => {
    delete import.meta.env.NOTIFICATION_EMAIL;
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(mocks.alertOps.mock.calls[0][0].errorMessage).toBe(
      "NOTIFICATION_EMAIL is not set",
    );
  });
});
