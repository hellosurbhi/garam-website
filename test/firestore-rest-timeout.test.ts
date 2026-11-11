import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

/**
 * A Firestore call that never answers must fail fast, not hold a serverless
 * function until the platform kills it with no message to the applicant.
 */
vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn(async () => "token"),
}));

const { fsGet, fsAdd, fsPatch, fsQuery } = await import("@/lib/firestoreRest");

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

// WHY a hand-driven signal: AbortSignal.timeout runs on the runtime's own
// clock, so vitest fake timers never advance it and a "hangs forever" test
// would sit until the test timeout. Capturing the requested delay and firing
// the signal ourselves proves both the 10s ceiling and the abort path.
let timeouts: number[];
let controllers: AbortController[];

beforeEach(() => {
  vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "test-project");
  timeouts = [];
  controllers = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    const controller = new AbortController();
    timeouts.push(ms);
    controllers.push(controller);
    return controller.signal;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("firestoreRest: no call can hang forever", () => {
  it.each([
    ["fsGet", () => fsGet("applications/x")],
    ["fsAdd", () => fsAdd("applications", { a: 1 })],
    ["fsPatch", () => fsPatch("applications/x", { a: 1 })],
    ["fsQuery", () => fsQuery("applications", "status", "New")],
  ])("%s aborts after 10s when Firestore never answers", async (_n, run) => {
    vi.stubGlobal("fetch", hangUntilAborted());
    const settled = run().then(
      () => "resolved",
      () => "rejected",
    );
    await vi.waitFor(() => expect(controllers.length).toBeGreaterThan(0));
    expect(timeouts).toContain(10_000);
    controllers[0].abort(new DOMException("timed out", "TimeoutError"));
    expect(await settled).toBe("rejected");
  });
});
