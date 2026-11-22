// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.mock("jose", () => ({
  importPKCS8: vi.fn().mockResolvedValue({}),
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setSubject() {
      return this;
    }
    setAudience() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "fixture-jwt";
    }
  },
}));

const ROOT = "projects/demo-test/databases/(default)/documents";
const BASE = `https://firestore.googleapis.com/v1/${ROOT}`;
const TOKEN_RESPONSE = () =>
  Response.json({ access_token: "fixture-token", expires_in: 3600 });

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("FIREBASE_ADMIN_CLIENT_EMAIL", "fixture@example.test");
  vi.stubEnv("FIREBASE_ADMIN_PRIVATE_KEY", "fixture-key");
  vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "demo-test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function firestoreError(status: string, httpCode: number): Response {
  return Response.json(
    { error: { code: httpCode, message: "fixture", status } },
    { status: httpCode },
  );
}

describe("fsGetDocument", () => {
  it("returns decoded fields and the updateTime", async () => {
    fetchMock.mockResolvedValueOnce(TOKEN_RESPONSE()).mockResolvedValueOnce(
      Response.json({
        fields: { version: { integerValue: "3" }, note: { stringValue: "x" } },
        updateTime: "2026-11-11T10:00:00.123456Z",
      }),
    );
    const { fsGetDocument } = await import("./firestoreRest");
    await expect(fsGetDocument("eventsDraft/current")).resolves.toEqual({
      fields: { version: 3, note: "x" },
      updateTime: "2026-11-11T10:00:00.123456Z",
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}/eventsDraft/current`);
    expect(init.headers).toEqual({ Authorization: "Bearer fixture-token" });
  });

  it("returns null for a missing document", async () => {
    fetchMock
      .mockResolvedValueOnce(TOKEN_RESPONSE())
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const { fsGetDocument } = await import("./firestoreRest");
    await expect(fsGetDocument("eventsDraft/current")).resolves.toBeNull();
  });

  it("refuses a response with no updateTime instead of locking on nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(TOKEN_RESPONSE())
      .mockResolvedValueOnce(Response.json({ fields: {} }));
    const { fsGetDocument } = await import("./firestoreRest");
    await expect(fsGetDocument("eventsDraft/current")).rejects.toThrow(
      "no updateTime",
    );
  });

  it("throws on a server error", async () => {
    fetchMock
      .mockResolvedValueOnce(TOKEN_RESPONSE())
      .mockResolvedValueOnce(new Response("boom", { status: 500 }));
    const { fsGetDocument } = await import("./firestoreRest");
    await expect(fsGetDocument("eventsDraft/current")).rejects.toThrow(
      "fsGetDocument eventsDraft/current: 500",
    );
  });
});

describe("fsGetPublic", () => {
  it("reads with no credentials and no token exchange", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        fields: { snapshotJson: { stringValue: "{}" } },
        updateTime: "2026-11-11T10:00:00Z",
      }),
    );
    const { fsGetPublic } = await import("./firestoreRest");
    const signal = new AbortController().signal;
    await expect(
      fsGetPublic("eventsPublished/current", signal),
    ).resolves.toEqual({
      fields: { snapshotJson: "{}" },
      updateTime: "2026-11-11T10:00:00Z",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/eventsPublished/current`);
    expect(init.headers).toEqual({});
    expect(init.signal).toBe(signal);
  });

  it("does not fetch after the caller's deadline has passed", async () => {
    const { fsGetPublic } = await import("./firestoreRest");
    const controller = new AbortController();
    controller.abort(new Error("deadline"));
    await expect(
      fsGetPublic("eventsPublished/current", controller.signal),
    ).rejects.toThrow("deadline");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a rules denial as an error", async () => {
    fetchMock.mockResolvedValueOnce(firestoreError("PERMISSION_DENIED", 403));
    const { fsGetPublic } = await import("./firestoreRest");
    await expect(fsGetPublic("eventsDraft/current")).rejects.toThrow(
      "fsGetPublic eventsDraft/current: 403",
    );
  });
});

describe("fsCommit", () => {
  it("posts every write with its name, mask and precondition", async () => {
    fetchMock
      .mockResolvedValueOnce(TOKEN_RESPONSE())
      .mockResolvedValueOnce(Response.json({ commitTime: "t" }));
    const { fsCommit } = await import("./firestoreRest");
    await fsCommit([
      {
        docPath: "eventVersions/v000002",
        fields: { version: 2 },
        precondition: { exists: false },
      },
      {
        docPath: "eventsPublished/current",
        fields: { version: 2, rebuild: null },
        precondition: { updateTime: "2026-11-11T10:00:00Z" },
      },
      {
        docPath: "eventsDraft/current",
        fields: { basedOnVersion: 2 },
        merge: true,
      },
    ]);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}:commit`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer fixture-token");
    expect(JSON.parse(init.body)).toEqual({
      writes: [
        {
          update: {
            name: `${ROOT}/eventVersions/v000002`,
            fields: { version: { integerValue: "2" } },
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `${ROOT}/eventsPublished/current`,
            fields: {
              version: { integerValue: "2" },
              rebuild: { nullValue: null },
            },
          },
          currentDocument: { updateTime: "2026-11-11T10:00:00Z" },
        },
        {
          update: {
            name: `${ROOT}/eventsDraft/current`,
            fields: { basedOnVersion: { integerValue: "2" } },
          },
          updateMask: { fieldPaths: ["basedOnVersion"] },
        },
      ],
    });
  });

  it("throws CommitConflictError when a precondition fails", async () => {
    fetchMock
      .mockResolvedValueOnce(TOKEN_RESPONSE())
      .mockResolvedValueOnce(firestoreError("FAILED_PRECONDITION", 400));
    const { fsCommit, CommitConflictError } = await import("./firestoreRest");
    const err = await fsCommit([
      { docPath: "a/b", fields: {}, precondition: { exists: false } },
    ]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CommitConflictError);
    expect((err as InstanceType<typeof CommitConflictError>).status).toBe(
      "FAILED_PRECONDITION",
    );
  });
});

describe("fsQueryOrdered", () => {
  it("runs an ordered, limited, projected query and decodes each document", async () => {
    fetchMock.mockResolvedValueOnce(TOKEN_RESPONSE()).mockResolvedValueOnce(
      Response.json([
        {
          document: {
            name: `${ROOT}/eventVersions/v000002`,
            fields: { version: { integerValue: "2" } },
          },
        },
        // runQuery ends with a document-less row carrying only readTime.
        { readTime: "2026-11-11T10:00:00Z" },
      ]),
    );
    const { fsQueryOrdered } = await import("./firestoreRest");
    const rows = await fsQueryOrdered({
      collectionId: "eventVersions",
      orderBy: "version",
      direction: "DESCENDING",
      limit: 20,
      select: ["version", "note"],
    });
    expect(rows).toEqual([{ id: "v000002", fields: { version: 2 } }]);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}:runQuery`);
    expect(JSON.parse(init.body)).toEqual({
      structuredQuery: {
        from: [{ collectionId: "eventVersions" }],
        orderBy: [{ field: { fieldPath: "version" }, direction: "DESCENDING" }],
        limit: 20,
        select: { fields: [{ fieldPath: "version" }, { fieldPath: "note" }] },
      },
    });
  });

  it("throws with the status on failure", async () => {
    fetchMock
      .mockResolvedValueOnce(TOKEN_RESPONSE())
      .mockResolvedValueOnce(new Response("boom", { status: 500 }));
    const { fsQueryOrdered } = await import("./firestoreRest");
    await expect(
      fsQueryOrdered({
        collectionId: "eventVersions",
        orderBy: "version",
        direction: "DESCENDING",
        limit: 1,
      }),
    ).rejects.toThrow("fsQueryOrdered eventVersions: 500 boom");
  });
});

describe("commitFailure", () => {
  // Firestore picks the HTTP code per case and API surface; only the
  // canonical status is stable, so every pairing must classify the same.
  const conflicts = ["FAILED_PRECONDITION", "ALREADY_EXISTS", "ABORTED"];
  const httpCodes = [400, 409, 412];

  for (const status of conflicts) {
    for (const code of httpCodes) {
      it(`${status} with HTTP ${code} is a conflict`, async () => {
        const { commitFailure, CommitConflictError } =
          await import("./firestoreRest");
        const body = await firestoreError(status, code).text();
        const err = commitFailure(code, body);
        expect(err).toBeInstanceOf(CommitConflictError);
        expect(err.message).toContain(status);
      });
    }
  }

  it.each([
    ["PERMISSION_DENIED", 403],
    ["NOT_FOUND", 404],
    ["INVALID_ARGUMENT", 400],
    ["UNAVAILABLE", 503],
  ])("%s with HTTP %i is not a conflict", async (status, code) => {
    const { commitFailure, CommitConflictError } =
      await import("./firestoreRest");
    const err = commitFailure(code, await firestoreError(status, code).text());
    expect(err).not.toBeInstanceOf(CommitConflictError);
    expect(err.message).toContain(status);
  });

  it.each(["<html>Bad gateway</html>", "null", '{"error":"x"}', ""])(
    "a body without a canonical status (%j) is a plain error",
    async (body) => {
      const { commitFailure, CommitConflictError } =
        await import("./firestoreRest");
      const err = commitFailure(502, body);
      expect(err).not.toBeInstanceOf(CommitConflictError);
      expect(err.message).toBe(`fsCommit: 502 ${body}`);
    },
  );
});
