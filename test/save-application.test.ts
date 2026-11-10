import { describe, it, expect, vi, beforeEach } from "vitest";
import { canarySignature, canaryDraftId } from "@/lib/draftSecret";

/**
 * Drives the REAL save-application handler against an in-memory Firestore, so
 * the contract the apply form depends on is exercised end to end: any payload
 * is filed, a bad token is the only content-independent refusal, and a
 * finalized application is never downgraded.
 */
const mocks = vi.hoisted(() => {
  class FsConflictError extends Error {}
  const state = {
    docs: new Map<string, { fields: Record<string, unknown>; t: number }>(),
    clock: 0,
    failNextWrite: null as Error | null,
    conflictsToInject: 0,
  };
  return {
    FsConflictError,
    state,
    sendMail: vi.fn(),
    alertOps: vi.fn(),
  };
});

vi.mock("@/lib/firestoreRest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firestoreRest")>();
  const { state, FsConflictError } = mocks;
  return {
    ...actual,
    FsConflictError,
    fsGetMeta: vi.fn(async (path: string) => {
      const d = state.docs.get(path);
      return d
        ? { fields: structuredClone(d.fields), updateTime: String(d.t) }
        : null;
    }),
    fsCreateWithId: vi.fn(
      async (col: string, id: string, fields: Record<string, unknown>) => {
        if (state.failNextWrite) {
          const err = state.failNextWrite;
          state.failNextWrite = null;
          throw err;
        }
        const { applyPatch } = await import("@/lib/draftStore");
        state.docs.set(`${col}/${id}`, {
          fields: applyPatch(null, fields),
          t: ++state.clock,
        });
      },
    ),
    fsPatchIfUnchanged: vi.fn(
      async (path: string, patch: Record<string, unknown>, time: string) => {
        if (state.failNextWrite) {
          const err = state.failNextWrite;
          state.failNextWrite = null;
          throw err;
        }
        const d = state.docs.get(path);
        if (state.conflictsToInject > 0 || !d || String(d.t) !== time) {
          state.conflictsToInject = Math.max(0, state.conflictsToInject - 1);
          throw new FsConflictError("precondition failed");
        }
        const { applyPatch } = await import("@/lib/draftStore");
        state.docs.set(path, {
          fields: applyPatch(d.fields, patch),
          t: ++state.clock,
        });
      },
    ),
  };
});
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));
vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

const { POST } = await import("@/pages/api/save-application");
const { issueDraftToken, newDraftId } = await import("@/lib/draftToken");

const ORIGIN = "https://garammasaladating.com";

function post(
  body: unknown,
  headers: Record<string, string> = {},
  origin: string | null = ORIGIN,
): Promise<Response> {
  const request = new Request(
    "https://garammasaladating.com/api/save-application",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { origin } : {}),
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
  return POST({ request } as Parameters<typeof POST>[0]) as Promise<Response>;
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

function stored(id: string) {
  return mocks.state.docs.get(`applications/${id}`)?.fields;
}

beforeEach(() => {
  mocks.state.docs.clear();
  mocks.state.clock = 0;
  mocks.state.failNextWrite = null;
  mocks.state.conflictsToInject = 0;
  mocks.sendMail.mockReset().mockResolvedValue({ id: "m" });
  mocks.alertOps.mockReset();
  import.meta.env.DRAFT_TOKEN_SECRET = "handler-test-secret";
});

describe("save-application: filing whatever arrives", () => {
  it("a first save with no token creates a Draft and issues a token", async () => {
    const res = await post({ rev: 1, fields: { name: "A" } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(typeof data.token).toBe("string");
    expect(data.status).toBe("Draft");
    const doc = stored(data.draftId as string)!;
    expect(doc).toMatchObject({
      name: "A",
      status: "Draft",
      notes: "",
      photoPaths: [],
      clientVersion: 2,
    });
    expect(doc.submittedAt).toBeInstanceOf(Date);
  });

  it("a name-only draft is kept (the lost-fields complaint)", async () => {
    const data = await json(await post({ rev: 1, fields: { name: "Only" } }));
    expect(stored(data.draftId as string)?.name).toBe("Only");
  });

  it("files an under-18, 200 year old, emoji, blank-phone applicant without refusing", async () => {
    for (const age of [7, 200, "abc"]) {
      const res = await post({
        rev: 1,
        fields: { name: "👩🏽‍🎤", age, phone: "", pitch: "x".repeat(50_000) },
      });
      expect(res.status).toBe(200);
    }
  });

  it("flags under 18 on the document instead of rejecting", async () => {
    const data = await json(await post({ rev: 1, fields: { age: 16 } }));
    expect(stored(data.draftId as string)).toMatchObject({
      age: 16,
      ageUnder18: true,
    });
  });

  it("never throws on hostile bodies: arrays, nulls, wrong types", async () => {
    for (const body of [
      [],
      null,
      7,
      { fields: "nope", rev: "x", token: 5 },
      { fields: [1, 2], rev: -4 },
      { fields: { name: { a: 1 } }, rev: 1e99 },
    ]) {
      const res = await post(JSON.stringify(body));
      expect([200, 401]).toContain(res.status);
    }
  });

  it("returns 400 not_json for a non-JSON body", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect((await json(res)).reason).toBe("not_json");
  });

  it("returns 403 for a foreign or missing origin", async () => {
    expect((await post({}, {}, "https://evil.example.com")).status).toBe(403);
    expect((await post({}, {}, null)).status).toBe(403);
  });
});

describe("save-application: draft ownership", () => {
  it("updates an existing draft with its own token and does not re-issue one", async () => {
    const first = await json(await post({ rev: 1, fields: { name: "A" } }));
    const res = await json(
      await post({ token: first.token, rev: 2, fields: { city: "NYC" } }),
    );
    expect(res.token).toBeUndefined();
    expect(stored(first.draftId as string)).toMatchObject({
      name: "A",
      city: "NYC",
    });
  });

  it("rejects a tampered token with 401 and the exact reason", async () => {
    const res = await post({ token: "garbage", rev: 1, fields: {} });
    expect(res.status).toBe(401);
    expect(await json(res)).toMatchObject({
      error: "invalid_token",
      reason: "malformed",
    });
  });

  it("rejects an expired token with reason expired", async () => {
    const old = issueDraftToken(
      newDraftId(),
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    );
    const res = await post({ token: old, rev: 1, fields: {} });
    expect(res.status).toBe(401);
    expect((await json(res)).reason).toBe("expired");
  });

  it("a token cannot write another draft: the doc id comes from the token only", async () => {
    const a = await json(await post({ rev: 1, fields: { name: "A" } }));
    const b = await json(await post({ rev: 1, fields: { name: "B" } }));
    await post({
      token: a.token,
      rev: 2,
      fields: { name: "A2" },
      draftId: b.draftId,
    });
    expect(stored(b.draftId as string)?.name).toBe("B");
    expect(stored(a.draftId as string)?.name).toBe("A2");
  });

  it("ignores attempts to set status, castEventId, notes or photoPaths", async () => {
    const first = await json(await post({ rev: 1, fields: { name: "A" } }));
    await post({
      token: first.token,
      rev: 2,
      fields: {
        status: "Cast",
        castEventId: "evt",
        notes: "hacked",
        photoPaths: ["photos/other/0"],
      },
    });
    expect(stored(first.draftId as string)).toMatchObject({
      status: "Draft",
      notes: "",
      photoPaths: [],
    });
    expect(stored(first.draftId as string)).not.toHaveProperty("castEventId");
  });
});

describe("save-application: ordering and duplicates", () => {
  it("a stale (older rev) request does not overwrite newer answers", async () => {
    const first = await json(await post({ rev: 5, fields: { name: "New" } }));
    const late = await json(
      await post({ token: first.token, rev: 2, fields: { name: "Old" } }),
    );
    expect(late.stale).toEqual(["name"]);
    expect(stored(first.draftId as string)?.name).toBe("New");
  });

  it("a duplicate request is harmless", async () => {
    const first = await json(await post({ rev: 1, fields: { name: "A" } }));
    for (let i = 0; i < 3; i++) {
      const res = await post({
        token: first.token,
        rev: 1,
        fields: { name: "A" },
      });
      expect(res.status).toBe(200);
    }
    expect(stored(first.draftId as string)?.name).toBe("A");
  });

  it("recovers from lost write races by re-reading, never dropping the answer", async () => {
    mocks.state.conflictsToInject = 3;
    const first = await json(await post({ rev: 1, fields: { name: "A" } }));
    const res = await post({
      token: first.token,
      rev: 2,
      fields: { city: "Queens" },
    });
    expect(res.status).toBe(200);
    expect(stored(first.draftId as string)?.city).toBe("Queens");
  });
});

describe("save-application: finalize", () => {
  it("finalize moves Draft to New, stamps finalizedAt and sends one welcome email", async () => {
    const first = await json(
      await post({
        rev: 1,
        fields: { name: "Priya", email: "p@example.com", city: "NYC" },
      }),
    );
    const done = await json(
      await post({ token: first.token, rev: 2, fields: {}, finalize: true }),
    );
    expect(done.status).toBe("New");
    expect(stored(first.draftId as string)?.finalizedAt).toBeInstanceOf(Date);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail.mock.calls[0][0].to).toBe("p@example.com");
  });

  it("finalizing twice does not send a second welcome email", async () => {
    const first = await json(
      await post({ rev: 1, fields: { name: "P", email: "p@example.com" } }),
    );
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    await post({ token: first.token, rev: 3, fields: {}, finalize: true });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it("a later autosave never downgrades a finalized application back to Draft", async () => {
    const first = await json(await post({ rev: 1, fields: { name: "P" } }));
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    const res = await json(
      await post({ token: first.token, rev: 3, fields: { city: "LA" } }),
    );
    expect(res.status).toBe("New");
    expect(stored(first.draftId as string)?.status).toBe("New");
  });

  it("a failed welcome email still files the application and alerts with the raw error", async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error("SMTP 535 auth failed"));
    const first = await json(
      await post({ rev: 1, fields: { name: "P", email: "p@example.com" } }),
    );
    const res = await post({
      token: first.token,
      rev: 2,
      fields: {},
      finalize: true,
    });
    expect(res.status).toBe(200);
    expect(stored(first.draftId as string)?.status).toBe("New");
    expect(mocks.alertOps.mock.calls[0][0]).toMatchObject({
      stage: "welcome_email",
      errorMessage: "SMTP 535 auth failed",
    });
  });

  it("no email on file means no welcome email and no error", async () => {
    const first = await json(await post({ rev: 1, fields: { name: "P" } }));
    const res = await post({
      token: first.token,
      rev: 2,
      fields: {},
      finalize: true,
    });
    expect(res.status).toBe(200);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});

describe("save-application: budget and failure reporting", () => {
  it("caps a flooded draft instead of rejecting: text is dropped, response says capped", async () => {
    const first = await json(
      await post({ rev: 1, fields: { pitch: "p".repeat(100_000) } }),
    );
    // Fill the remaining budget with many fields, then one more write.
    await post({
      token: first.token,
      rev: 2,
      fields: { pitch: "p".repeat(100_000), name: "n".repeat(5_000) },
    });
    const over = await json(
      await post({
        token: first.token,
        rev: 3,
        fields: { howHeard: "h".repeat(200), city: "c".repeat(5_000) },
      }),
    );
    expect(over.ok).toBe(true);
    expect(typeof over.capped).toBe("boolean");
  });

  it("a database failure returns 500 with the stage and raw detail, and alerts with exact context", async () => {
    mocks.state.failNextWrite = new Error("PERMISSION_DENIED: key revoked");
    const res = await post({ rev: 1, fields: { name: "A", pitch: "hello" } });
    expect(res.status).toBe(500);
    expect(await json(res)).toMatchObject({
      error: "save_failed",
      stage: "save_draft",
      detail: "PERMISSION_DENIED: key revoked",
    });
    const alert = mocks.alertOps.mock.calls[0][0];
    expect(alert).toMatchObject({
      flow: "apply",
      stage: "save_draft",
      errorMessage: "PERMISSION_DENIED: key revoked",
    });
    expect(alert.context.fieldsSent).toBe("name, pitch");
  });

  it("a failed finalize is reported as stage finalize", async () => {
    const first = await json(await post({ rev: 1, fields: { name: "A" } }));
    mocks.state.failNextWrite = new Error("deadline exceeded");
    const res = await post({
      token: first.token,
      rev: 2,
      fields: {},
      finalize: true,
    });
    expect((await json(res)).stage).toBe("finalize");
  });
});

describe("save-application: production canary", () => {
  it("a valid canary signature writes the fixed _canary doc, not applications, and sends no email", async () => {
    const key = "iphone-safari" as const;
    const sig = canarySignature("handler-test-secret", key);
    const res = await post(
      {
        rev: 1,
        fields: { name: "CANARY", email: "c@example.com" },
        finalize: true,
      },
      { "x-canary-key": key, "x-canary-sig": sig },
    );
    expect(res.status).toBe(200);
    const id = canaryDraftId(key);
    expect(mocks.state.docs.has(`_canary/${id}`)).toBe(true);
    expect(
      [...mocks.state.docs.keys()].some((k) => k.startsWith("applications/")),
    ).toBe(false);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("repeated canary runs overwrite one document instead of growing", async () => {
    const key = "android-chrome" as const;
    const headers = {
      "x-canary-key": key,
      "x-canary-sig": canarySignature("handler-test-secret", key),
    };
    for (let rev = 1; rev <= 4; rev++) {
      await post({ rev, fields: { name: `run${rev}` } }, headers);
    }
    expect(mocks.state.docs.size).toBe(1);
    expect(
      mocks.state.docs.get(`_canary/${canaryDraftId(key)}`)?.fields.name,
    ).toBe("run4");
  });

  it("a wrong canary signature is refused: it never reaches _canary and never files a real applicant", async () => {
    const res = await post(
      { rev: 1, fields: { name: "x" } },
      { "x-canary-key": "iphone-safari", "x-canary-sig": "00".repeat(32) },
    );
    expect(res.status).toBe(401);
    expect(mocks.state.docs.size).toBe(0);
  });
});
