import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAlertOps = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockDel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/opsAlert", () => ({ alertOps: mockAlertOps }));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    set = mockSet;
    del = mockDel;
  },
}));

const { alertOpsOnce } = await import("@/lib/alertDedupe");

const report = (errorMessage: string) => ({
  flow: "apply",
  stage: "save_application",
  errorMessage,
});

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

  it("suppresses a duplicate inside the window without sending", async () => {
    mockSet.mockResolvedValue(null);
    await expect(alertOpsOnce(report("Firestore 503"))).resolves.toBe(true);
    expect(mockAlertOps).not.toHaveBeenCalled();
  });

  it("treats the same cause with different ids and numbers as one incident", async () => {
    mockSet.mockResolvedValue("OK");
    await alertOpsOnce(report("draft 8f3a1c9e2b7d4455 failed after 1200ms"));
    await alertOpsOnce(report("draft 91bc00ffeeaa1122 failed after 987ms"));
    expect(mockSet.mock.calls[0][0]).toBe(mockSet.mock.calls[1][0]);
  });

  it("a different cause gets its own key so it still pages", async () => {
    mockSet.mockResolvedValue("OK");
    await alertOpsOnce(report("Firestore 503"));
    await alertOpsOnce(report("Storage signing key missing"));
    expect(mockSet.mock.calls[0][0]).not.toBe(mockSet.mock.calls[1][0]);
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
