import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * A Firestore call that never answers must fail fast, not hold a serverless
 * function until the platform kills it with no message to the applicant.
 */
vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn(async () => "token"),
}));

const { fsGet, fsAdd, fsPatch } = await import("@/lib/firestoreRest");

function hangUntilAborted() {
  return vi.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason),
        );
      }),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("firestoreRest: no call can hang forever", () => {
  it.each([
    ["fsGet", () => fsGet("applications/x")],
    ["fsAdd", () => fsAdd("applications", { a: 1 })],
    ["fsPatch", () => fsPatch("applications/x", { a: 1 })],
  ])("%s rejects when Firestore never answers", async (_name, run) => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangUntilAborted());
    const settled = run().then(
      () => "resolved",
      () => "rejected",
    );
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await settled).toBe("rejected");
  });
});
