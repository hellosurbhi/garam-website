import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  token: vi.fn(),
}));
vi.mock("./firestoreRest", () => ({ fsGet: mocks.get, fsPatch: mocks.patch }));
vi.mock("./firestoreAdmin", () => ({ getFirestoreAccessToken: mocks.token }));
let getWaitlistRanking: typeof import("./waitlistRanking.server").getWaitlistRanking;

const counts = [{ citySlug: "houston", count: 4 }];
const fetchMock = vi.fn();
beforeEach(async () => {
  vi.resetModules();
  ({ getWaitlistRanking } = await import("./waitlistRanking.server"));
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
      expect.any(AbortSignal),
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

it("retries after a stale-cache deadline and late work cannot unlock the retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.get.mockResolvedValue({ updatedAt: 0, counts });
  let finishOld!: (value: string) => void;
  let finishNew!: (value: string) => void;
  mocks.token
    .mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishOld = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishNew = resolve;
      }),
    );
  const first = getWaitlistRanking();
  const concurrent = getWaitlistRanking();
  expect(concurrent).toBe(first);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await first).toEqual(counts);
  expect(await concurrent).toEqual(counts);
  expect(mocks.token.mock.calls[0][0].aborted).toBe(true);
  const retry = getWaitlistRanking();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.get).toHaveBeenCalledTimes(2);
  finishOld("late-token");
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(getWaitlistRanking()).toBe(retry);
  expect(mocks.get).toHaveBeenCalledTimes(2);
  fetchMock.mockResolvedValue(Response.json([]));
  finishNew("new-token");
  expect(await retry).toEqual([]);
  expect(mocks.patch).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("allows recovery after a cold-cache read ignores cancellation", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let finishOld!: (value: unknown) => void;
  mocks.get.mockReturnValueOnce(
    new Promise((resolve) => {
      finishOld = resolve;
    }),
  );
  const failed = expect(getWaitlistRanking()).rejects.toThrow(
    "Timeout: waitlist ranking",
  );
  await vi.advanceTimersByTimeAsync(15_000);
  await failed;
  mocks.get.mockResolvedValue({ updatedAt: Date.now(), counts });
  expect(await getWaitlistRanking()).toEqual(counts);
  finishOld({
    updatedAt: Date.now(),
    counts: [{ citySlug: "old-city", count: 99 }],
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mocks.patch).not.toHaveBeenCalled();
  mocks.get.mockRejectedValue(new Error("offline"));
  expect(await getWaitlistRanking()).toEqual(counts);
});

it("clears its deadline after normal completion", async () => {
  mocks.get.mockResolvedValue({ updatedAt: Date.now(), counts });
  expect(await getWaitlistRanking()).toEqual(counts);
  expect(vi.getTimerCount()).toBe(0);
});
it("aborts a hanging cache write and retains the old ranking", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.get.mockResolvedValue({ updatedAt: 0, counts });
  fetchMock.mockResolvedValue(Response.json([]));
  mocks.patch.mockImplementation(
    (_path, _data, signal: AbortSignal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  );
  const result = getWaitlistRanking();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await result).toEqual(counts);
  expect(mocks.patch.mock.calls[0][2].aborted).toBe(true);
  mocks.get.mockResolvedValue({ updatedAt: Date.now(), counts });
  expect(await getWaitlistRanking()).toEqual(counts);
  expect(mocks.get).toHaveBeenCalledTimes(2);
});

it("propagates the overall deadline to the cache read and lead query", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.get.mockResolvedValue({ updatedAt: 0, counts });
  fetchMock.mockImplementation(
    (_url, options: RequestInit) =>
      new Promise((_, reject) => {
        options.signal?.addEventListener(
          "abort",
          () => reject(options.signal?.reason),
          { once: true },
        );
      }),
  );
  const result = getWaitlistRanking();
  await vi.advanceTimersByTimeAsync(0);
  const readSignal: AbortSignal = mocks.get.mock.calls[0][1];
  const querySignal: AbortSignal = fetchMock.mock.calls[0][1].signal;
  expect(readSignal.aborted).toBe(false);
  expect(querySignal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(readSignal.aborted).toBe(true);
  expect(querySignal.aborted).toBe(true);
  expect(await result).toEqual(counts);
  expect(mocks.patch).not.toHaveBeenCalled();
});
