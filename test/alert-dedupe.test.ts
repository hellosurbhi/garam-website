import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAlertOps = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockDel = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/opsAlert", () => ({ alertOps: mockAlertOps }));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    set = mockSet;
    del = mockDel;
    get = mockGet;
  },
}));

const { alertOpsOnce } = await import("@/lib/alertDedupe");

const report = (errorMessage: string) => ({
  flow: "apply",
  stage: "save_application",
  errorMessage,
});

// Claims are the NX sets; confirm() adds a second XX set per delivered alert.
const claimKeys = () =>
  mockSet.mock.calls.filter((c) => c[2]?.nx).map((c) => c[0]);

beforeEach(() => {
  vi.clearAllMocks();
  mockAlertOps.mockResolvedValue(true);
  mockDel.mockResolvedValue(1);
  import.meta.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  import.meta.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  delete import.meta.env.UPSTASH_REDIS_REST_URL;
  delete import.meta.env.UPSTASH_REDIS_REST_TOKEN;
  vi.restoreAllMocks();
});

describe("alertOpsOnce", () => {
  it("sends the first report of an incident", async () => {
    mockSet.mockResolvedValue("OK");
    await expect(alertOpsOnce(report("Firestore 503"))).resolves.toBe(true);
    expect(mockAlertOps).toHaveBeenCalledTimes(1);
    expect(mockSet.mock.calls[0][2]).toEqual({ nx: true, ex: 3600 });
  });

  it("keeps an HTTP status in the key so a 503 outage is not hidden behind a 403 one", async () => {
    mockSet.mockResolvedValue("OK");
    await alertOpsOnce(report("firestore HTTP 403: denied"));
    await alertOpsOnce(report("firestore HTTP 503: denied"));
    await alertOpsOnce(report("firestore HTTP 503: denied"));
    const keys = claimKeys();
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[1]).toBe(keys[2]);
  });

  it("suppresses a duplicate inside the window without sending", async () => {
    mockSet.mockResolvedValue(null);
    mockGet.mockResolvedValue("sent");
    await expect(alertOpsOnce(report("Firestore 503"))).resolves.toBe(true);
    expect(mockAlertOps).not.toHaveBeenCalled();
  });

  it("a duplicate whose claim vanished (first send failed and released) is not reported as delivered", async () => {
    mockSet.mockResolvedValue(null);
    mockGet.mockResolvedValue(null);
    await expect(alertOpsOnce(report("Firestore 503"))).resolves.toBe(false);
  });

  it("a duplicate whose first send is still in flight is not reported as delivered", async () => {
    mockSet.mockResolvedValue(null);
    mockGet.mockResolvedValue("sending");
    await expect(alertOpsOnce(report("Firestore 503"))).resolves.toBe(false);
    expect(mockAlertOps).not.toHaveBeenCalled();
  });

  it("marks the claim sent after delivery so later duplicates are suppressed", async () => {
    mockSet.mockResolvedValue("OK");
    await alertOpsOnce(report("Firestore 503"));
    expect(mockSet.mock.calls[1][1]).toBe("sent");
    expect(mockSet.mock.calls[1][2]).toEqual({ xx: true, ex: 3600 });
  });

  it("treats the same cause with different ids and numbers as one incident", async () => {
    mockSet.mockResolvedValue("OK");
    await alertOpsOnce(report("draft 8f3a1c9e2b7d4455 failed after 1200ms"));
    await alertOpsOnce(report("draft 91bc00ffeeaa1122 failed after 987ms"));
    expect(claimKeys()[0]).toBe(claimKeys()[1]);
  });

  it("a different cause gets its own key so it still pages", async () => {
    mockSet.mockResolvedValue("OK");
    await alertOpsOnce(report("Firestore 503"));
    await alertOpsOnce(report("Storage signing key missing"));
    expect(claimKeys()[0]).not.toBe(claimKeys()[1]);
  });

  it("fails open and sends when Redis errors", async () => {
    mockSet.mockRejectedValue(new Error("redis down"));
    await expect(alertOpsOnce(report("Firestore 503"))).resolves.toBe(true);
    expect(mockAlertOps).toHaveBeenCalledTimes(1);
  });

  it("fails open and sends when Redis is not configured", async () => {
    delete import.meta.env.UPSTASH_REDIS_REST_URL;
    await alertOpsOnce(report("Firestore 503"));
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockAlertOps).toHaveBeenCalledTimes(1);
  });

  it("gives the claim back when no channel delivered, so the next report pages", async () => {
    mockSet.mockResolvedValue("OK");
    mockAlertOps.mockResolvedValue(false);
    await expect(alertOpsOnce(report("Firestore 503"))).resolves.toBe(false);
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel.mock.calls[0][0]).toBe(mockSet.mock.calls[0][0]);
  });
});
