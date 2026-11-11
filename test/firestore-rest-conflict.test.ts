import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

/**
 * The handler tests mock firestoreRest and throw FsConflictError by hand, so
 * nothing else proves the REAL status mapping. Firestore answers a lost
 * updateTime precondition with HTTP 400 FAILED_PRECONDITION.
 */
vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn(async () => "token"),
}));

const { fsPatchIfUnchanged, fsCreateWithId, FsConflictError } =
  await import("@/lib/firestoreRest");

function reply(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

beforeEach(() => vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "test-project"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("firestoreRest: lost races are conflicts, real failures are not", () => {
  it("maps 400 FAILED_PRECONDITION to a conflict", async () => {
    reply(400, {
      error: { code: 400, status: "FAILED_PRECONDITION", message: "stale" },
    });
    await expect(
      fsPatchIfUnchanged("a/b", { x: 1 }, "t"),
    ).rejects.toBeInstanceOf(FsConflictError);
  });

  it.each([409, 412])("maps %s to a conflict", async (status) => {
    reply(status, { error: { status: "ABORTED" } });
    await expect(
      fsPatchIfUnchanged("a/b", { x: 1 }, "t"),
    ).rejects.toBeInstanceOf(FsConflictError);
  });

  it("does not hide an unrelated 400 as a conflict", async () => {
    reply(400, { error: { status: "INVALID_ARGUMENT", message: "bad" } });
    const err = await fsPatchIfUnchanged("a/b", { x: 1 }, "t").catch(
      (e: unknown) => e,
    );
    expect(err).not.toBeInstanceOf(FsConflictError);
    expect((err as Error).message).toContain("INVALID_ARGUMENT");
  });

  it("maps a create onto an existing id to a conflict", async () => {
    reply(409, { error: { status: "ALREADY_EXISTS" } });
    await expect(fsCreateWithId("a", "b", { x: 1 })).rejects.toBeInstanceOf(
      FsConflictError,
    );
  });
});
