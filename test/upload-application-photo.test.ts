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
    // "before": the write is lost; "after": it commits but the response is lost.
    failPatch: null as "before" | "after" | null,
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
    // Enforces the updateTime precondition like Firestore does, so concurrent
    // requests lose races and re-run their callbacks instead of overwriting.
    fsPatchIfUnchanged: vi.fn(
      async (
        path: string,
        patch: Record<string, unknown>,
        updateTime: string,
      ) => {
        const { applyPatch } = await import("@/lib/draftStore");
        const d = state.docs.get(path)!;
        if (String(d.t) !== updateTime) throw new actual.FsConflictError(path);
        if (state.failPatch === "before") throw new Error("firestore down");
        state.docs.set(path, {
          fields: applyPatch(d.fields, patch),
          t: ++state.clock,
        });
        if (state.failPatch === "after") throw new Error("response lost");
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
    deleteObject: vi.fn(async (path: string) => {
      state.objects.delete(path);
    }),
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
  mocks.state.failPatch = null;
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

  it("two confirms of the same path racing each other count its bytes once", async () => {
    const { id, token } = seedDraft();
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, { size: 100, contentType: "image/jpeg" });
    const [a, b] = await Promise.all([
      call(token, { action: "confirm", path }),
      call(token, { action: "confirm", path }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
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

describe("upload-application-photo: a finished application is closed", () => {
  it("refuses reserve, confirm, remove and relay on a finalized draft", async () => {
    const { id, token } = seedDraft({ finalizedAt: new Date() });
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, { size: 10, contentType: "image/jpeg" });
    const bodies = [
      { action: "reserve", filename: "a.jpg" },
      { action: "confirm", path },
      { action: "remove", path },
    ];
    for (const body of bodies) {
      const res = await call(token, body);
      expect(res.status).toBe(409);
      expect(await json(res)).toMatchObject({ error: "finalized" });
    }
    const relay = await call(token, null, {
      relay: true,
      raw: new Uint8Array([1, 2, 3]),
    });
    expect(relay.status).toBe(409);
    const stored = mocks.state.docs.get(`applications/${id}`)!.fields;
    expect(stored.photoPaths).toEqual([]);
  });

  it("a finalize committing after the handler's read still closes reserve, confirm, remove and relay", async () => {
    const { fsGet } = await import("@/lib/firestoreRest");
    const { id, token } = seedDraft({ finalizedAt: new Date() });
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, { size: 10, contentType: "image/jpeg" });
    const bodies = [
      { action: "reserve", filename: "a.jpg" },
      { action: "confirm", path },
      { action: "remove", path },
    ];
    for (const body of bodies) {
      // The top-of-request read sees the draft as still open; only the
      // conditional write sees the finalize that landed in between.
      vi.mocked(fsGet).mockImplementationOnce(async () => ({
        status: "Draft",
        photoPaths: [],
      }));
      const res = await call(token, body);
      expect(res.status).toBe(409);
      expect(await json(res)).toMatchObject({ error: "finalized" });
    }
    vi.mocked(fsGet).mockImplementationOnce(async () => ({
      status: "Draft",
      photoPaths: [],
    }));
    const relay = await call(token, null, {
      relay: true,
      raw: new Uint8Array([1, 2, 3]),
    });
    expect(relay.status).toBe(409);
    const stored = mocks.state.docs.get(`applications/${id}`)!.fields;
    expect(stored.photoPaths).toEqual([]);
    expect(stored.photoReservations).toBeUndefined();
  });

  it("the canary document is reused every run, so finalizedAt never blocks it", async () => {
    const { canarySignature, canaryDraftId } =
      await import("@/lib/draftSecret");
    const key = "android-chrome" as const;
    mocks.state.docs.set(`_canary/${canaryDraftId(key)}`, {
      fields: { status: "Draft", finalizedAt: new Date() },
      t: ++mocks.state.clock,
    });
    const ts = Math.floor(Date.now() / 1000);
    const res = await call(
      null,
      { action: "reserve", filename: "p.jpg", index: 0 },
      {
        headers: {
          "x-canary-key": key,
          "x-canary-ts": String(ts),
          "x-canary-sig": canarySignature("photo-test-secret", key, ts),
        },
      },
    );
    expect(res.status).toBe(200);
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

  it("refuses to confirm an 11th photo even if it was reserved earlier", async () => {
    const paths = Array.from({ length: 10 }, (_, i) => `photos/x/${i}.jpg`);
    const { id, token } = seedDraft({ photoPaths: paths });
    const path = `photos/${id}/11-aaaa.jpg`;
    mocks.state.objects.set(path, { size: 10, contentType: "image/jpeg" });
    const res = await call(token, { action: "confirm", path });
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: "photo_quota" });
    expect(photoPaths(id)).toHaveLength(10);
  });

  it("removing a photo gives its bytes back so swapping photos never hits the byte quota", async () => {
    const { id, token } = seedDraft();
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, {
      size: 60 * 1024 * 1024,
      contentType: "image/jpeg",
    });
    await call(token, { action: "confirm", path });
    await call(token, { action: "remove", path });
    expect(mocks.state.docs.get(`applications/${id}`)?.fields.photoBytes).toBe(
      0,
    );
    const next = `photos/${id}/2-bbbb.jpg`;
    mocks.state.objects.set(next, {
      size: 60 * 1024 * 1024,
      contentType: "image/jpeg",
    });
    expect((await call(token, { action: "confirm", path: next })).status).toBe(
      200,
    );
  });

  it("a retried confirm of an already kept photo succeeds even at the byte cap", async () => {
    const { id, token } = seedDraft();
    const path = `photos/${id}/1-aaaa.jpg`;
    mocks.state.objects.set(path, {
      size: 60 * 1024 * 1024,
      contentType: "image/jpeg",
    });
    await call(token, { action: "confirm", path });
    const again = await call(token, { action: "confirm", path });
    expect(again.status).toBe(200);
    expect(photoPaths(id)).toEqual([path]);
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

describe("upload-application-photo: quotas hold under concurrent requests", () => {
  const MB = 1024 * 1024;

  it("5 racing confirms with 8 photos kept keep exactly 10", async () => {
    const { id, token } = seedDraft({
      photoPaths: Array.from({ length: 8 }, (_, i) => `photos/x/${i}.jpg`),
    });
    const paths = Array.from(
      { length: 5 },
      (_, i) => `photos/${id}/${i}-aaaa.jpg`,
    );
    for (const p of paths) {
      mocks.state.objects.set(p, { size: 1000, contentType: "image/jpeg" });
    }
    const results = await Promise.all(
      paths.map((path) => call(token, { action: "confirm", path })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect(photoPaths(id)).toHaveLength(10);
  });

  it("racing reserves at 39 reservations yield exactly one success", async () => {
    const { id, token } = seedDraft({ photoReservations: 39 });
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        call(token, { action: "reserve", filename: "p.jpg" }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(
      mocks.state.docs.get(`applications/${id}`)?.fields.photoReservations,
    ).toBe(40);
  });

  it("racing confirms near 100MB never exceed the byte budget", async () => {
    const { id, token } = seedDraft({ photoBytes: 90 * MB });
    const paths = Array.from(
      { length: 5 },
      (_, i) => `photos/${id}/${i}-bbbb.jpg`,
    );
    for (const p of paths) {
      mocks.state.objects.set(p, { size: 4 * MB, contentType: "image/jpeg" });
    }
    const results = await Promise.all(
      paths.map((path) => call(token, { action: "confirm", path })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    const bytes = mocks.state.docs.get(`applications/${id}`)?.fields
      .photoBytes as number;
    expect(bytes).toBeLessThanOrEqual(100 * MB);
  });

  it("a retried confirm racing its original near the byte cap succeeds twice", async () => {
    const { id, token } = seedDraft({ photoBytes: 98 * MB });
    const path = `photos/${id}/1-cccc.jpg`;
    mocks.state.objects.set(path, {
      size: 1.5 * MB,
      contentType: "image/jpeg",
    });
    const results = await Promise.all([
      call(token, { action: "confirm", path }),
      call(token, { action: "confirm", path }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(mocks.state.docs.get(`applications/${id}`)?.fields.photoBytes).toBe(
      98 * MB + 1.5 * MB,
    );
  });

  it("a confirm racing a remove of the same path never drifts the byte count", async () => {
    const { id, token } = seedDraft({ photoBytes: 5 * MB });
    const path = `photos/${id}/1-dddd.jpg`;
    mocks.state.objects.set(path, { size: 2 * MB, contentType: "image/jpeg" });
    await Promise.all([
      call(token, { action: "confirm", path }),
      call(token, { action: "remove", path }),
    ]);
    const fields = mocks.state.docs.get(`applications/${id}`)?.fields;
    const kept = (fields?.photoPaths as string[]).includes(path);
    expect(fields?.photoBytes).toBe(kept ? 7 * MB : 5 * MB);
  });

  it("racing relays at 39 reservations store exactly one object", async () => {
    const { id, token } = seedDraft({ photoReservations: 39 });
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        call(token, null, {
          relay: true,
          raw: new Uint8Array(500),
          headers: {
            "Content-Type": "image/jpeg",
            "x-photo-filename": "a.jpg",
          },
        }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(photoPaths(id)).toHaveLength(1);
    expect(mocks.state.objects.size).toBe(1);
  });

  it("a relay whose write was lost keeps its object, because only a committed discard marker makes deleting safe", async () => {
    const { token } = seedDraft();
    mocks.state.failPatch = "before";
    const res = await call(token, null, {
      relay: true,
      raw: new Uint8Array(500),
      headers: { "Content-Type": "image/jpeg", "x-photo-filename": "a.jpg" },
    });
    expect(res.status).toBe(500);
    expect(mocks.state.objects.size).toBe(1);
  });

  it("a relay whose write committed but whose response was lost keeps its object", async () => {
    const { id, token } = seedDraft();
    mocks.state.failPatch = "after";
    const res = await call(token, null, {
      relay: true,
      raw: new Uint8Array(500),
      headers: { "Content-Type": "image/jpeg", "x-photo-filename": "a.jpg" },
    });
    expect(res.status).toBe(500);
    expect(photoPaths(id)).toHaveLength(1);
    expect(mocks.state.objects.size).toBe(1);
  });

  it("a refused confirm removes the stored file", async () => {
    const { id, token } = seedDraft({ photoBytes: 99 * MB });
    const path = `photos/${id}/1-eeee.jpg`;
    mocks.state.objects.set(path, { size: 5 * MB, contentType: "image/jpeg" });
    const res = await call(token, { action: "confirm", path });
    expect(res.status).toBe(409);
    expect(mocks.state.objects.has(path)).toBe(false);
  });

  it("a refused confirm keeps the file when the draft holds the path by the time it cleans up", async () => {
    const { id, token } = seedDraft({
      photoPaths: Array.from({ length: 10 }, (_, i) => `photos/x/${i}.jpg`),
    });
    const path = `photos/${id}/1-gggg.jpg`;
    mocks.state.objects.set(path, { size: MB, contentType: "image/jpeg" });
    const { fsGetMeta } = await import("@/lib/firestoreRest");
    const real = vi.mocked(fsGetMeta).getMockImplementation()!;
    let reads = 0;
    // Read 1 is the confirm's own write; the cleanup's conditional write reads
    // next, by which time a retried confirm has recorded this path.
    vi.mocked(fsGetMeta).mockImplementation(async (docPath: string) => {
      const doc = await real(docPath);
      return ++reads >= 2 && doc
        ? {
            ...doc,
            fields: {
              ...doc.fields,
              photoPaths: [...(doc.fields.photoPaths as string[]), path],
            },
          }
        : doc;
    });
    try {
      const res = await call(token, { action: "confirm", path });
      expect(res.status).toBe(409);
      expect(mocks.state.objects.has(path)).toBe(true);
    } finally {
      vi.mocked(fsGetMeta).mockImplementation(real);
    }
  });

  it("a signing failure does not consume a reservation slot", async () => {
    const { id, token } = seedDraft({ photoReservations: 3 });
    const { signUploadUrl } = await import("@/lib/storageAdmin");
    vi.mocked(signUploadUrl).mockImplementationOnce(() => {
      throw new Error("no signing key");
    });
    const res = await call(token, {
      action: "reserve",
      contentType: "image/jpeg",
    });
    expect(res.status).toBe(500);
    expect(
      mocks.state.docs.get(`applications/${id}`)?.fields.photoReservations,
    ).toBe(3);
  });

  it("a path discarded by a refused confirm can never be attached afterwards", async () => {
    const { id, token } = seedDraft({ photoBytes: 99 * MB });
    const path = `photos/${id}/1-hhhh.jpg`;
    mocks.state.objects.set(path, { size: 5 * MB, contentType: "image/jpeg" });
    await call(token, { action: "confirm", path });
    expect(mocks.state.objects.has(path)).toBe(false);
    // A twin confirm lands later, after room was freed: it must not list a
    // photo whose file is gone.
    mocks.state.docs.get(`applications/${id}`)!.fields.photoBytes = 0;
    mocks.state.objects.set(path, { size: MB, contentType: "image/jpeg" });
    const res = await call(token, { action: "confirm", path });
    expect(res.status).toBe(409);
    expect(photoPaths(id)).not.toContain(path);
  });

  it("remove gives back the size counted at confirm, not the bucket's current size", async () => {
    const { id, token } = seedDraft();
    const path = `photos/${id}/1-ffff.jpg`;
    mocks.state.objects.set(path, { size: 3 * MB, contentType: "image/jpeg" });
    await call(token, { action: "confirm", path });
    // The object is overwritten after confirm; remove must still free 3MB.
    mocks.state.objects.set(path, { size: 9 * MB, contentType: "image/jpeg" });
    await call(token, { action: "remove", path });
    const fields = mocks.state.docs.get(`applications/${id}`)?.fields;
    expect(fields?.photoBytes).toBe(0);
    expect(fields?.photoPaths).toEqual([]);
  });

  it("a refused relay removes the object it had already stored", async () => {
    const { id, token } = seedDraft({
      photoPaths: Array.from({ length: 9 }, (_, i) => `photos/x/${i}.jpg`),
    });
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        call(token, null, {
          relay: true,
          raw: new Uint8Array(500),
          headers: {
            "Content-Type": "image/jpeg",
            "x-photo-filename": "a.jpg",
          },
        }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(photoPaths(id)).toHaveLength(10);
    // Only the kept relay object remains in the bucket.
    expect(mocks.state.objects.size).toBe(1);
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

  it("counts relayed bytes and a reservation against the draft", async () => {
    const { id, token } = seedDraft();
    await call(token, null, { relay: true, raw: new Uint8Array(500) });
    const fields = mocks.state.docs.get(`applications/${id}`)?.fields;
    expect(fields?.photoBytes).toBe(500);
    expect(fields?.photoReservations).toBe(1);
  });

  it("refuses a relay once the draft is out of photo, reservation or byte quota", async () => {
    for (const extra of [
      { photoPaths: Array.from({ length: 10 }, (_, i) => `p${i}`) },
      { photoReservations: 40 },
      { photoBytes: 100 * 1024 * 1024 },
    ]) {
      const { token } = seedDraft(extra);
      const res = await call(token, null, {
        relay: true,
        raw: new Uint8Array(10),
      });
      expect(res.status).toBe(409);
      expect((await json(res)).error).toBe("photo_quota");
    }
  });

  it("decodes a percent-encoded filename header and keeps its extension", async () => {
    const { token } = seedDraft();
    const res = await call(token, null, {
      relay: true,
      raw: new Uint8Array(10),
      headers: { "x-photo-filename": encodeURIComponent("照片.png") },
    });
    expect((await json(res)).path as string).toMatch(/\.png$/);
  });

  it("ignores a malformed filename header instead of failing the photo", async () => {
    const { token } = seedDraft();
    const res = await call(token, null, {
      relay: true,
      raw: new Uint8Array(10),
      headers: { "x-photo-filename": "%E0%A4%A" },
    });
    expect(res.status).toBe(200);
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

  it("a bucket failure is a 500 that names the stage and a safe cause, and alerts with the raw one", async () => {
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
      detail: "storage answered HTTP 403",
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
    const ts = Math.floor(Date.now() / 1000);
    const headers = {
      "x-canary-key": key,
      "x-canary-ts": String(ts),
      "x-canary-sig": canarySignature("photo-test-secret", key, ts),
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

  it("a canary draft past both photo caps still reserves, a normal draft in the same state does not", async () => {
    const { canarySignature, canaryDraftId } =
      await import("@/lib/draftSecret");
    const key = "android-chrome" as const;
    const full = {
      photoReservations: 500,
      photoPaths: Array.from({ length: 10 }, (_, i) => `photos/x/${i}.jpg`),
    };
    mocks.state.docs.set(`_canary/${canaryDraftId(key)}`, {
      fields: { status: "Draft", ...full },
      t: ++mocks.state.clock,
    });
    const ts = Math.floor(Date.now() / 1000);
    const canary = await call(
      null,
      { action: "reserve", filename: "p.jpg", index: 0 },
      {
        headers: {
          "x-canary-key": key,
          "x-canary-ts": String(ts),
          "x-canary-sig": canarySignature("photo-test-secret", key, ts),
        },
      },
    );
    expect(canary.status).toBe(200);

    const { token } = seedDraft(full);
    const normal = await call(token, { action: "reserve", filename: "p.jpg" });
    expect(normal.status).toBe(409);
  });
});
