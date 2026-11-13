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
    inflate: false,
    racingFinalize: false,
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
        if (state.racingFinalize && d) {
          // A second finalize lands first: the doc is finalized and the
          // caller's write loses its precondition.
          state.racingFinalize = false;
          d.fields.finalizedAt = new Date();
          d.fields.welcomeSentAt = new Date();
          d.t = ++state.clock;
          throw new FsConflictError("precondition failed");
        }
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
// WHY: sanitizeFields clips every field, so the largest draft the real form
// can build is about 130k characters, under the 200k budget. The budget is a
// guard for future fields, so the only way to reach it is to inflate values
// after sanitizing. Off by default; tests in the budget block switch it on.
vi.mock("@/lib/applicationDraft", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/applicationDraft")>();
  return {
    ...actual,
    sanitizeFields: (raw: unknown) => {
      const out = actual.sanitizeFields(raw);
      if (mocks.state.inflate) {
        for (const [k, v] of Object.entries(out.values)) {
          if (typeof v === "string") out.values[k] = v.padEnd(150_000, "x");
        }
      }
      return out;
    },
  };
});
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));
vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

const { POST } = await import("@/pages/api/save-application");
const { enforceRateLimit, RATE_LIMITS } = await import("@/lib/rateLimit");
const { issueDraftToken, newDraftId } = await import("@/lib/draftToken");

const ORIGIN = "https://garammasaladating.com";

/** Every required answer, so a finalize in these tests is promoted to New. */
const COMPLETE = {
  name: "P",
  email: "p@example.com",
  instagram: "p",
  termsAgreed: true,
};

function canaryHeaders(
  key: "iphone-safari" | "android-chrome" | "instagram-webview",
  ageSeconds = 0,
): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000) - ageSeconds;
  return {
    "x-canary-key": key,
    "x-canary-ts": String(ts),
    "x-canary-sig": canarySignature("handler-test-secret", key, ts),
  };
}

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
  mocks.state.inflate = false;
  mocks.state.racingFinalize = false;
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

  it("returns 403 for a foreign origin", async () => {
    expect((await post({}, {}, "https://evil.example.com")).status).toBe(403);
  });

  it("rate-limits tokenless draft creation but not updates of an existing draft", async () => {
    const limiter = vi.mocked(enforceRateLimit);
    limiter.mockClear();
    const first = await json(await post({ rev: 1, fields: { name: "A" } }));
    expect(limiter).toHaveBeenCalledWith(
      expect.anything(),
      RATE_LIMITS.newApplicationDraft,
    );
    limiter.mockClear();
    await post({ token: first.token, rev: 2, fields: { city: "NYC" } });
    expect(limiter).not.toHaveBeenCalledWith(
      expect.anything(),
      RATE_LIMITS.newApplicationDraft,
    );
  });

  it("accepts a request with no Origin header (privacy tools strip it)", async () => {
    expect(
      (await post({ rev: 1, fields: { name: "A" } }, {}, null)).status,
    ).toBe(200);
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

describe("save-application: finalize completeness gate", () => {
  const complete = {
    name: "Priya",
    email: "p@example.com",
    instagram: "priya",
    termsAgreed: true,
  };

  it.each([
    ["name", { ...complete, name: "" }],
    ["email", { ...complete, email: "" }],
    ["a malformed email", { ...complete, email: "not-an-email" }],
    ["instagram", { ...complete, instagram: "@" }],
    ["terms", { ...complete, termsAgreed: false }],
  ])(
    "finalize with %s missing keeps the draft a Draft",
    async (_label, fields) => {
      const first = await json(await post({ rev: 1, fields }));
      const done = await json(
        await post({ token: first.token, rev: 2, fields: {}, finalize: true }),
      );
      expect(done.status).toBe("Draft");
      expect((done.incomplete as string[]).length).toBeGreaterThan(0);
      expect(stored(first.draftId as string)?.finalizedAt).toBeUndefined();
      expect(mocks.sendMail).not.toHaveBeenCalled();
    },
  );

  it("a complete finalize becomes New with nothing missing", async () => {
    const first = await json(await post({ rev: 1, fields: complete }));
    const done = await json(
      await post({ token: first.token, rev: 2, fields: {}, finalize: true }),
    );
    expect(done.status).toBe("New");
    expect(done.incomplete).toEqual([]);
  });

  it("a draft finalized while incomplete is promoted once the missing answer arrives", async () => {
    const first = await json(
      await post({ rev: 1, fields: { ...complete, instagram: "" } }),
    );
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    const done = await json(
      await post({
        token: first.token,
        rev: 3,
        fields: { instagram: "priya" },
        finalize: true,
      }),
    );
    expect(done.status).toBe("New");
  });
});

describe("save-application: finalize", () => {
  it("finalize moves Draft to New, stamps finalizedAt and sends one welcome email", async () => {
    const first = await json(
      await post({
        rev: 1,
        fields: { ...COMPLETE, name: "Priya", city: "NYC" },
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
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    await post({ token: first.token, rev: 3, fields: {}, finalize: true });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it("a retried finalize resends the welcome email when the first send never finished", async () => {
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    const doc = stored(first.draftId as string)!;
    // The function died after the claim: no delivery stamp, claim is old.
    delete doc.welcomeDeliveredAt;
    doc.welcomeSentAt = new Date(Date.now() - 10 * 60_000);
    await post({ token: first.token, rev: 3, fields: {}, finalize: true });
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(stored(first.draftId as string)?.welcomeDeliveredAt).toBeInstanceOf(
      Date,
    );
  });

  it("the plain save the client sends first also resends, and still answers finalized", async () => {
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    const doc = stored(first.draftId as string)!;
    delete doc.welcomeDeliveredAt;
    doc.welcomeSentAt = new Date(Date.now() - 10 * 60_000);
    const res = await post({ token: first.token, rev: 3, fields: {} });
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: "finalized" });
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(stored(first.draftId as string)?.welcomeDeliveredAt).toBeInstanceOf(
      Date,
    );
  });

  it("a retried finalize right after the claim does not resend while the first send may still run", async () => {
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    delete stored(first.draftId as string)!.welcomeDeliveredAt;
    await post({ token: first.token, rev: 3, fields: {}, finalize: true });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it("a finalize that loses a race to another finalize sends no welcome email of its own", async () => {
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
    mocks.state.racingFinalize = true;
    const res = await post({
      token: first.token,
      rev: 2,
      fields: {},
      finalize: true,
    });
    expect(res.status).toBe(200);
    // The winner owns the welcome email; the retried loser must not repeat it.
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("a finished application is closed to a later write with the same token", async () => {
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    const res = await post({
      token: first.token,
      rev: 3,
      fields: { city: "LA", name: "Hijacked" },
    });
    expect(res.status).toBe(409);
    expect((await json(res)).error).toBe("finalized");
    const doc = stored(first.draftId as string);
    expect(doc?.status).toBe("New");
    expect(doc?.name).toBe("P");
    expect(doc?.city).toBeUndefined();
  });

  it("a repeated finalize (lost response) succeeds without rewriting anything", async () => {
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
    await post({ token: first.token, rev: 2, fields: {}, finalize: true });
    const again = await post({
      token: first.token,
      rev: 3,
      fields: { name: "Hijacked" },
      finalize: true,
    });
    expect(again.status).toBe(200);
    expect(stored(first.draftId as string)?.name).toBe("P");
  });

  it("returns the highest stored revision so a lagging client can catch up", async () => {
    const first = await json(await post({ rev: 9, fields: { name: "P" } }));
    const behind = await json(
      await post({ token: first.token, rev: 2, fields: { name: "Old" } }),
    );
    expect(behind.stale).toEqual(["name"]);
    expect(behind.maxRev).toBe(9);
    expect(stored(first.draftId as string)?.name).toBe("P");
  });

  it("does not finalize while a field is refused as stale", async () => {
    const first = await json(await post({ rev: 9, fields: { name: "P" } }));
    const res = await json(
      await post({
        token: first.token,
        rev: 2,
        fields: { name: "Old" },
        finalize: true,
      }),
    );
    expect(res.stale).toEqual(["name"]);
    expect(stored(first.draftId as string)?.status).toBe("Draft");
  });

  it("a failed welcome email still files the application and alerts with the raw error", async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error("SMTP 535 auth failed"));
    const first = await json(await post({ rev: 1, fields: { ...COMPLETE } }));
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

  it("no email on file means no welcome email and no error (the draft stays a Draft)", async () => {
    const first = await json(
      await post({ rev: 1, fields: { ...COMPLETE, email: "" } }),
    );
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
    mocks.state.inflate = true;
    const first = await json(await post({ rev: 1, fields: { pitch: "p" } }));
    expect(first.capped).toBe(false);
    const over = await json(
      await post({ token: first.token, rev: 2, fields: { name: "n" } }),
    );
    expect(over.ok).toBe(true);
    expect(over.capped).toBe(true);
    // The dropped text must not count as stored: no value and no revision, so
    // the client can resend it as a newer write.
    const doc = stored(first.draftId as string) as Record<string, unknown>;
    expect(doc.name).toBeUndefined();
    expect((doc.fieldRevs as Record<string, number>).name).toBeUndefined();
    expect((doc.fieldRevs as Record<string, number>).pitch).toBe(1);
  });

  it("does not finalize a draft whose text was dropped over the size budget", async () => {
    mocks.state.inflate = true;
    const first = await json(await post({ rev: 1, fields: { pitch: "p" } }));
    const over = await json(
      await post({
        token: first.token,
        rev: 2,
        fields: { name: "n" },
        finalize: true,
      }),
    );
    expect(over.capped).toBe(true);
    const doc = stored(first.draftId as string) as Record<string, unknown>;
    expect(doc.finalizedAt).toBeUndefined();
  });

  it("a database failure returns 500 with the stage and a safe cause, and alerts with the exact one", async () => {
    mocks.state.failNextWrite = new Error("PERMISSION_DENIED: key revoked");
    const res = await post({ rev: 1, fields: { name: "A", pitch: "hello" } });
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({
      error: "save_failed",
      stage: "save_draft",
      detail: "server error",
    });
    // The raw upstream message is for the ops alert only.
    expect(body).not.toContain("key revoked");
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
    const res = await post(
      {
        rev: 1,
        fields: { name: "CANARY", email: "c@example.com" },
        finalize: true,
      },
      canaryHeaders(key),
    );
    expect(res.status).toBe(200);
    const id = canaryDraftId(key);
    expect(mocks.state.docs.has(`_canary/${id}`)).toBe(true);
    expect(
      [...mocks.state.docs.keys()].some((k) => k.startsWith("applications/")),
    ).toBe(false);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("the first canary save hands a token back so the browser can reserve photos", async () => {
    const res = await post(
      { rev: 1, fields: { name: "CANARY" } },
      canaryHeaders("iphone-safari"),
    );
    expect(typeof (await json(res)).token).toBe("string");
    const again = await post(
      { token: "anything", rev: 2, fields: { name: "CANARY" } },
      canaryHeaders("iphone-safari"),
    );
    expect((await json(again)).token).toBeUndefined();
  });

  it("every canary finalize restamps finalizedAt, so the read-back can tell this run from the last", async () => {
    const key = "iphone-safari" as const;
    const id = canaryDraftId(key);
    await post(
      { rev: 1, fields: { ...COMPLETE, name: "run1" }, finalize: true },
      canaryHeaders(key),
    );
    const first = mocks.state.docs.get(`_canary/${id}`)?.fields
      .finalizedAt as Date;
    await new Promise((r) => setTimeout(r, 5));
    await post(
      { rev: 2, fields: { ...COMPLETE, name: "run2" }, finalize: true },
      canaryHeaders(key),
    );
    const second = mocks.state.docs.get(`_canary/${id}`)?.fields
      .finalizedAt as Date;
    expect(new Date(second).getTime()).toBeGreaterThan(
      new Date(first).getTime(),
    );
  });

  it("repeated canary runs overwrite one document instead of growing", async () => {
    const key = "android-chrome" as const;
    for (let rev = 1; rev <= 4; rev++) {
      await post({ rev, fields: { name: `run${rev}` } }, canaryHeaders(key));
    }
    expect(mocks.state.docs.size).toBe(1);
    expect(
      mocks.state.docs.get(`_canary/${canaryDraftId(key)}`)?.fields.name,
    ).toBe("run4");
  });

  it("a wrong canary signature is refused: it never reaches _canary and never files a real applicant", async () => {
    const res = await post(
      { rev: 1, fields: { name: "x" } },
      {
        ...canaryHeaders("iphone-safari"),
        "x-canary-sig": "00".repeat(32),
      },
    );
    expect(res.status).toBe(401);
    expect(mocks.state.docs.size).toBe(0);
  });

  it("a replayed canary signature older than the window is refused", async () => {
    const res = await post(
      { rev: 1, fields: { name: "x" } },
      canaryHeaders("iphone-safari", 301),
    );
    expect(res.status).toBe(401);
    expect(mocks.state.docs.size).toBe(0);
  });

  it("a canary signature dated in the future beyond the window is refused", async () => {
    const res = await post(
      { rev: 1, fields: { name: "x" } },
      canaryHeaders("iphone-safari", -301),
    );
    expect(res.status).toBe(401);
  });

  it("a canary request with no timestamp is refused", async () => {
    const noTs = canaryHeaders("iphone-safari");
    delete noTs["x-canary-ts"];
    const res = await post({ rev: 1, fields: { name: "x" } }, noTs);
    expect(res.status).toBe(401);
    expect(mocks.state.docs.size).toBe(0);
  });

  it("a canary request with a non-numeric timestamp is refused", async () => {
    const res = await post(
      { rev: 1, fields: { name: "x" } },
      { ...canaryHeaders("iphone-safari"), "x-canary-ts": "abc" },
    );
    expect(res.status).toBe(401);
  });
});
