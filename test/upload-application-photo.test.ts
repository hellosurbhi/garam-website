import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The photo endpoint against an in-memory Firestore and a fake bucket. The
 * guarantees pinned here: any format is accepted, a photo is recorded on the
 * draft only once it exists in the bucket, a draft can only touch its own
 * folder, and every failure names its stage and raw cause.
 */
const mocks = vi.hoisted(() => {
  const state = {
    docs: new Map<string, { fields: Record<string, unknown>; t: number }>(),
    clock: 0,
    objects: new Map<string, { size: number; contentType: string }>(),
    failPut: null as Error | null,
  };
  return { state, alertOps: vi.fn() };
});

vi.mock("@/lib/firestoreRest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firestoreRest")>();
  const { state } = mocks;
  return {
    ...actual,
    fsGet: vi.fn(async (path: string) => {
      const d = state.docs.get(path);
      return d ? structuredClone(d.fields) : null;
    }),
    fsGetMeta: vi.fn(async (path: string) => {
      const d = state.docs.get(path);
      return d
        ? { fields: structuredClone(d.fields), updateTime: String(d.t) }
        : null;
    }),
    fsCreateWithId: vi.fn(
      async (col: string, id: string, fields: Record<string, unknown>) => {
        const { applyPatch } = await import("@/lib/draftStore");
        state.docs.set(`${col}/${id}`, {
          fields: applyPatch(null, fields),
          t: ++state.clock,
        });
      },
    ),
    fsPatchIfUnchanged: vi.fn(
      async (path: string, patch: Record<string, unknown>) => {
        const d = state.docs.get(path)!;
        const { applyPatch } = await import("@/lib/draftStore");
        state.docs.set(path, {
          fields: applyPatch(d.fields, patch),
          t: ++state.clock,
        });
      },
    ),
  };
});
vi.mock("@/lib/storageAdmin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storageAdmin")>();
  const { state } = mocks;
  return {
    ...actual,
    signUploadUrl: vi.fn((name: string, contentType: string) => ({
      url: `https://storage.googleapis.com/b/${name}?sig=1`,
      contentType,
      expiresInSeconds: 900,
    })),
    headObject: vi.fn(async (path: string) => state.objects.get(path) ?? null),
    putObject: vi.fn(
      async (path: string, bytes: ArrayBuffer, contentType: string) => {
        if (state.failPut) throw state.failPut;
        state.objects.set(path, { size: bytes.byteLength, contentType });
      },
    ),
  };
});
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));
vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

const { POST } = await import("@/pages/api/upload-application-photo");
const { issueDraftToken, newDraftId } = await import("@/lib/draftToken");

const ORIGIN = "https://garammasaladating.com";

function seedDraft(extra: Record<string, unknown> = {}) {
  const id = newDraftId();
  mocks.state.docs.set(`applications/${id}`, {
    fields: { status: "Draft", photoPaths: [], ...extra },
    t: ++mocks.state.clock,
  });
  return { id, token: issueDraftToken(id) };
}

function call(
  token: string | null,
  body: unknown,
  opts: {
    relay?: boolean;
    raw?: Uint8Array;
    headers?: Record<string, string>;
  } = {},
) {
  const url = `https://garammasaladating.com/api/upload-application-photo${opts.relay ? "?relay=1" : ""}`;
  const request = new Request(url, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      ...(token ? { "x-draft-token": token } : {}),
      ...(opts.raw ? {} : { "Content-Type": "application/json" }),
      ...opts.headers,
    },
    body: opts.raw ?? JSON.stringify(body),
  });
  return POST({ request, url: new URL(url) } as Parameters<
    typeof POST
  >[0]) as Promise<Response>;
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

function photoPaths(id: string) {
  return mocks.state.docs.get(`applications/${id}`)?.fields
    .photoPaths as string[];
}

beforeEach(() => {
  mocks.state.docs.clear();
  mocks.state.objects.clear();
  mocks.state.clock = 0;
  mocks.state.failPut = null;
  mocks.alertOps.mockReset();
  import.meta.env.DRAFT_TOKEN_SECRET = "photo-test-secret";
});

describe("upload-application-photo: identity", () => {
  it("401s a missing token with reason no_token", async () => {
    const res = await call(null, { action: "reserve" });
    expect(res.status).toBe(401);
    expect((await json(res)).reason).toBe("no_token");
  });

  it("401s a tampered token with the exact reason", async () => {
    const res = await call("junk", { action: "reserve" });
    expect(res.status).toBe(401);
    expect((await json(res)).reason).toBe("malformed");
  });

  it("403s a foreign origin", async () => {
    const { token } = seedDraft();
    const request = new Request(
      "https://garammasaladating.com/api/upload-application-photo",
      {
        method: "POST",
        headers: { origin: "https://evil.example.com", "x-draft-token": token },
        body: "{}",
      },
    );
    const res = (await POST({
      request,
      url: new URL(request.url),
    } as Parameters<typeof POST>[0])) as Response;
    expect(res.status).toBe(403);
  });

  it("404s when the draft was never saved (photos attach to a saved draft)", async () => {
    const id = newDraftId();
    const res = await call(issueDraftToken(id), { action: "reserve" });
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe("draft_not_found");
  });
});

describe("upload-application-photo: any file, direct to the bucket", () => {
  it.each([
    ["IMG_0001.HEIC", "image/heic"],
    ["scan.tiff", "image/tiff"],
    ["weird", ""],
    ["movie.mov", "video/quicktime"],
  ])(
    "reserves a signed URL for %s (%s) without rejecting the type",
    async (filename, contentType) => {
      const { id, token } = seedDraft();
      const res = await call(token, {
        action: "reserve",
        filename,
        contentType,
        index: 0,
      });
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.ok).toBe(true);
      expect(String(data.path).startsWith(`photos/${id}/`)).toBe(true);
      expect(String(data.uploadUrl)).toContain("storage.googleapis.com");
    },
  );

  it("confirm records the path only after the object exists in the bucket", async () => {
    const { id, token } = seedDraft();
    const reserved = await json(
      await call(token, {
        action: "reserve",
        filename: "a.jpg",
        contentType: "image/jpeg",
      }),
    );
    const path = reserved.path as string;

    const missing = await call(token, { action: "confirm", path });
    expect(missing.status).toBe(409);
    expect((await json(missing)).error).toBe("object_missing");
    expect(photoPaths(id)).toEqual([]);

    mocks.state.objects.set(path, {
      size: 41 * 1024 * 1024,
      contentType: "image/jpeg",
    });
    const done = await call(token, { action: "confirm", path });
    expect(done.status).toBe(200);
    expect(photoPaths(id)).toEqual([path]);
  });

  it("a 41MB original is accepted (no size rejection)", async () => {
    const { id, token } = seedDraft();
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, {
      size: 41 * 1024 * 1024,
      contentType: "image/jpeg",
    });
    expect((await call(token, { action: "confirm", path })).status).toBe(200);
  });

  it("confirming the same path twice records it once", async () => {
    const { id, token } = seedDraft();
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, { size: 100, contentType: "image/jpeg" });
    await call(token, { action: "confirm", path });
    await call(token, { action: "confirm", path });
    expect(photoPaths(id)).toEqual([path]);
    expect(mocks.state.docs.get(`applications/${id}`)?.fields.photoBytes).toBe(
      100,
    );
  });

  it("refuses to confirm a path in another draft's folder or a traversal", async () => {
    const { token } = seedDraft();
    for (const path of [
      `photos/${"c".repeat(32)}/1.jpg`,
      "photos/../secrets",
      undefined,
    ]) {
      const res = await call(token, { action: "confirm", path });
      expect(res.status).toBe(400);
      expect((await json(res)).error).toBe("bad_path");
    }
  });

  it("remove takes a path off the draft", async () => {
    const { id, token } = seedDraft({
      photoPaths: ["photos/x/1.jpg", "photos/x/2.jpg"],
    });
    await call(token, { action: "remove", path: "photos/x/1.jpg" });
    expect(photoPaths(id)).toEqual(["photos/x/2.jpg"]);
  });

  it("an unknown action is a 400 with a reason, not a crash", async () => {
    const { token } = seedDraft();
    const res = await call(token, { action: "explode" });
    expect(res.status).toBe(400);
    expect((await json(res)).reason).toBe("unknown_action");
  });

  it("a non-JSON body is a 400 not_json", async () => {
    const { token } = seedDraft();
    const request = new Request(
      "https://garammasaladating.com/api/upload-application-photo",
      {
        method: "POST",
        headers: { origin: ORIGIN, "x-draft-token": token },
        body: "{nope",
      },
    );
    const res = (await POST({
      request,
      url: new URL(request.url),
    } as Parameters<typeof POST>[0])) as Response;
    expect(res.status).toBe(400);
  });
});

describe("upload-application-photo: quotas fail closed", () => {
  it("stops reserving once 10 photos are kept, with a clear photo_quota reply", async () => {
    const paths = Array.from({ length: 10 }, (_, i) => `photos/x/${i}.jpg`);
    const { token } = seedDraft({ photoPaths: paths });
    const res = await call(token, { action: "reserve", filename: "a.jpg" });
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: "photo_quota", kept: 10 });
  });

  it("caps endless reservations (a retry loop or a bot) at 40", async () => {
    const { token } = seedDraft({ photoReservations: 40 });
    const res = await call(token, { action: "reserve", filename: "a.jpg" });
    expect(res.status).toBe(409);
  });

  it("refuses to confirm past the 100MB byte budget", async () => {
    const { id, token } = seedDraft({ photoBytes: 99 * 1024 * 1024 });
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, {
      size: 5 * 1024 * 1024,
      contentType: "image/jpeg",
    });
    const res = await call(token, { action: "confirm", path });
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({
      error: "photo_quota",
      reason: "bytes",
    });
  });
});

describe("upload-application-photo: relay fallback", () => {
  it("stores raw bytes, records the path and returns it", async () => {
    const { id, token } = seedDraft();
    const bytes = new Uint8Array(1234);
    const res = await call(token, null, {
      relay: true,
      raw: bytes,
      headers: {
        "Content-Type": "image/heic",
        "x-photo-filename": "IMG_1.HEIC",
        "x-photo-index": "0",
      },
    });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data).toMatchObject({ ok: true, size: 1234 });
    expect(photoPaths(id)).toEqual([data.path]);
    expect(mocks.state.objects.get(data.path as string)).toMatchObject({
      size: 1234,
      contentType: "image/heic",
    });
  });

  it("413s a body over 4MB and says the limit", async () => {
    const { token } = seedDraft();
    const res = await call(token, null, {
      relay: true,
      raw: new Uint8Array(4 * 1024 * 1024 + 1),
    });
    expect(res.status).toBe(413);
    expect((await json(res)).limit).toBe(4 * 1024 * 1024);
  });

  it("a bucket failure is a 500 that names the stage and the raw cause, and alerts", async () => {
    const { token } = seedDraft();
    mocks.state.failPut = new Error(
      "storage 403: caller does not have storage.objects.create",
    );
    const res = await call(token, null, {
      relay: true,
      raw: new Uint8Array(10),
    });
    expect(res.status).toBe(500);
    expect(await json(res)).toMatchObject({
      error: "photo_failed",
      stage: "photo_relay",
      detail: "storage 403: caller does not have storage.objects.create",
    });
    expect(mocks.alertOps.mock.calls[0][0]).toMatchObject({
      flow: "apply",
      stage: "photo_relay",
      errorMessage: "storage 403: caller does not have storage.objects.create",
    });
  });
});

describe("upload-application-photo: canary never grows the bucket", () => {
  it("canary photo names are fixed per slot so each run overwrites the last", async () => {
    const { canarySignature, canaryDraftId } =
      await import("@/lib/draftSecret");
    const key = "iphone-safari" as const;
    const id = canaryDraftId(key);
    mocks.state.docs.set(`_canary/${id}`, {
      fields: { photoPaths: [] },
      t: ++mocks.state.clock,
    });
    const headers = {
      "x-canary-key": key,
      "x-canary-sig": canarySignature("photo-test-secret", key),
    };
    const names = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const res = await call(
        null,
        { action: "reserve", filename: "p.jpg", index: 0 },
        { headers },
      );
      names.add((await json(res)).path as string);
    }
    expect([...names]).toEqual([`photos/${id}/canary-0.jpg`]);
  });
});
