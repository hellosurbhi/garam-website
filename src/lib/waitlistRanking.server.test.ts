import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  token: vi.fn(),
}));
vi.mock("./firestoreRest", () => ({ fsGet: mocks.get, fsPatch: mocks.patch }));
vi.mock("./firestoreAdmin", () => ({ getFirestoreAccessToken: mocks.token }));
import { getWaitlistRanking } from "./waitlistRanking.server";

const counts = [{ citySlug: "houston", count: 4 }];
const fetchMock = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "demo-test");
  vi.stubGlobal("fetch", fetchMock);
  mocks.token.mockResolvedValue("local-token");
  mocks.patch.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("daily waitlist aggregate cache", () => {
  it("uses the aggregate without reading leads when fresh", async () => {
    mocks.get.mockResolvedValue({ updatedAt: Date.now(), counts });
    expect(await getWaitlistRanking()).toEqual(counts);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refreshes once for concurrent callers and persists only aggregate counts", async () => {
    mocks.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            document: {
              fields: {
                email: { stringValue: "person@real.test" },
                city: { stringValue: "Houston" },
                source: { stringValue: "tickets-notify" },
              },
            },
          },
          { document: {} },
          { readTime: "now" },
        ]),
      ),
    );
    const [a, b] = await Promise.all([
      getWaitlistRanking(),
      getWaitlistRanking(),
    ]);
    expect(a).toEqual([{ citySlug: "houston", count: 1 }]);
    expect(b).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.patch).toHaveBeenCalledWith(
      "systemConfig/ticketWaitlistRanking",
      { updatedAt: expect.any(Number), counts: a },
    );
    const query = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(
      query.structuredQuery.select.fields.map(
        (f: { fieldPath: string }) => f.fieldPath,
      ),
    ).toEqual(["email", "city", "sourceCitySlug", "source"]);
  });
  it("retains yesterday's list on a failed refresh", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.get.mockResolvedValue({ updatedAt: Date.now() - 90_000_000, counts });
    fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }));
    expect(await getWaitlistRanking()).toEqual(counts);
    expect(mocks.patch).not.toHaveBeenCalled();
  });
  it("surfaces failure without a prior cache, allowing the island's fallback", async () => {
    mocks.get.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(getWaitlistRanking()).rejects.toThrow("offline");
  });
  it("rejects malformed query responses instead of replacing a valid ranking", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.get.mockResolvedValue({ updatedAt: 0, counts });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "bad query" })),
    );
    expect(await getWaitlistRanking()).toEqual(counts);
    expect(mocks.patch).not.toHaveBeenCalled();
  });
  it("does not query an undefined project", async () => {
    mocks.get.mockResolvedValue(null);
    vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "");
    await expect(getWaitlistRanking()).rejects.toThrow(
      "PUBLIC_FIREBASE_PROJECT_ID",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("bounds a hanging cache read", async () => {
    mocks.get.mockReturnValue(new Promise(() => {}));
    const result = expect(getWaitlistRanking()).rejects.toThrow(
      "Timeout: waitlist ranking",
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });
});
