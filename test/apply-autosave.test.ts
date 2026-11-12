import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApplyRequestError, AutosaveController } from "@/lib/applyAutosave";

/**
 * The autosave controller is the part of the form a person never sees and
 * every lost-field complaint traces back to. These tests pin the guarantees:
 * every field is eventually acknowledged, nothing typed mid-request is lost,
 * order is serial, and a dead token or flaky network never loses data.
 */

interface Call {
  body: {
    token?: string;
    rev: number;
    fields: Record<string, unknown>;
    finalize?: boolean;
    clientVersion: number;
  };
  keepalive: boolean;
}

type Responder = (call: Call, n: number) => Response | Promise<Response>;

function ok(extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      draftId: "d".repeat(32),
      token: "tok-1",
      status: "Draft",
      ...extra,
    }),
    { status: 200 },
  );
}

function harness(responder: Responder = () => ok()) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const call: Call = {
      body: JSON.parse(String(init?.body)),
      keepalive: Boolean(init?.keepalive),
    };
    calls.push(call);
    return responder(call, calls.length);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("AutosaveController: typing becomes saved fields", () => {
  it("files a field shortly after the person pauses, with the client version", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Pri");
    c.setField("name", "Priya");
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(900);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({
      rev: 1,
      fields: { name: "Priya" },
      clientVersion: 2,
    });
    expect(calls[0].body.token).toBeUndefined();
    expect(c.hasDraft).toBe(true);
    expect(c.draftToken).toBe("tok-1");
  });

  it("sends the token and a higher rev on every later save", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900);
    c.setField("city", "NYC");
    await vi.advanceTimersByTimeAsync(900);
    expect(calls[1].body.token).toBe("tok-1");
    expect(calls[1].body.rev).toBeGreaterThan(calls[0].body.rev);
    expect(calls[1].body.fields).toEqual({ city: "NYC" });
  });

  it("a field typed while a request is in flight is not lost", async () => {
    let release: (r: Response) => void = () => {};
    const { calls, fetchImpl } = harness((_call, n) =>
      n === 1
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : ok(),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900);
    c.setField("name", "AB"); // typed during the request
    release(ok());
    await vi.advanceTimersByTimeAsync(2000);
    const last = calls[calls.length - 1];
    expect(last.body.fields).toEqual({ name: "AB" });
  });

  it("clearing a field sends an explicit empty value", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("pitch", "");
    await vi.advanceTimersByTimeAsync(900);
    expect(calls[0].body.fields).toEqual({ pitch: "" });
  });

  it("requests are serial: a second drain waits for the one in flight", async () => {
    let active = 0;
    let maxActive = 0;
    const { fetchImpl } = harness(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 300));
      active -= 1;
      return ok();
    });
    const c = new AutosaveController({ fetchImpl });
    for (let i = 0; i < 5; i++) {
      c.setField(`f${i}`, "x");
      await vi.advanceTimersByTimeAsync(850);
    }
    await vi.advanceTimersByTimeAsync(3000);
    expect(maxActive).toBe(1);
  });
});

describe("AutosaveController: failures never lose data", () => {
  it("retries with backoff until acknowledged and keeps the fields queued", async () => {
    let fail = 3;
    const { calls, fetchImpl } = harness(() =>
      fail-- > 0
        ? new Response(JSON.stringify({ error: "boom" }), { status: 500 })
        : ok(),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Keep");
    await vi.advanceTimersByTimeAsync(900); // attempt 1
    await vi.advanceTimersByTimeAsync(1_100); // attempt 2 after 1s
    await vi.advanceTimersByTimeAsync(2_100); // attempt 3 after 2s
    await vi.advanceTimersByTimeAsync(4_100); // attempt 4 after 4s succeeds
    expect(calls).toHaveLength(4);
    for (const call of calls)
      expect(call.body.fields).toEqual({ name: "Keep" });
    expect(c.hasDraft).toBe(true);
  });

  it("reports a persistent failure once, naming the real error", async () => {
    const { fetchImpl } = harness(
      () =>
        new Response(
          JSON.stringify({
            error: "save_failed",
            stage: "save_draft",
            detail: "PERMISSION_DENIED: key revoked",
          }),
          { status: 500 },
        ),
    );
    const onPersistentFailure = vi.fn();
    const c = new AutosaveController({ fetchImpl, onPersistentFailure });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onPersistentFailure).toHaveBeenCalledTimes(1);
    const [error, attempts] = onPersistentFailure.mock.calls[0] as [
      ApplyRequestError,
      number,
    ];
    expect(error.message).toBe(
      "save_draft: HTTP 500: PERMISSION_DENIED: key revoked",
    );
    expect(attempts).toBe(3);
  });

  it("a network error is described with its exact name and message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const onPersistentFailure = vi.fn();
    const c = new AutosaveController({ fetchImpl, onPersistentFailure });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onPersistentFailure.mock.calls[0][0].message).toBe(
      "save_draft: network error: TypeError: Failed to fetch",
    );
  });

  it("a non-JSON proxy error page still yields a useful reason", async () => {
    const { fetchImpl } = harness(
      () =>
        new Response("<html>Bad gateway</html>", {
          status: 502,
          statusText: "Bad Gateway",
        }),
    );
    const onPersistentFailure = vi.fn();
    const c = new AutosaveController({ fetchImpl, onPersistentFailure });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onPersistentFailure.mock.calls[0][0].message).toContain("HTTP 502");
  });

  it("a dead token starts a fresh draft and re-sends every field ever typed", async () => {
    const { calls, fetchImpl } = harness((call, n) =>
      call.body.token === "tok-1"
        ? new Response(
            JSON.stringify({ error: "invalid_token", reason: "expired" }),
            { status: 401 },
          )
        : ok({ token: n === 1 ? "tok-1" : "tok-2" }),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900); // creates tok-1
    c.setField("city", "NYC");
    await vi.advanceTimersByTimeAsync(900); // 401, then fresh draft
    const last = calls[calls.length - 1];
    expect(last.body.token).toBeUndefined();
    expect(last.body.fields).toEqual({ name: "A", city: "NYC" });
    expect(c.draftToken).toBe("tok-2");
  });
});

describe("AutosaveController: reload and storage", () => {
  it("after a reload, a dead token still re-sends fields that were already acknowledged", async () => {
    const first = harness();
    const c1 = new AutosaveController({ fetchImpl: first.fetchImpl });
    c1.setField("name", "Acked");
    c1.setField("city", "NYC");
    await vi.advanceTimersByTimeAsync(900); // both acknowledged, pending empty

    const second = harness((call) =>
      call.body.token === "tok-1"
        ? new Response(
            JSON.stringify({ error: "invalid_token", reason: "expired" }),
            { status: 401 },
          )
        : ok({ token: "tok-2" }),
    );
    const c2 = new AutosaveController({ fetchImpl: second.fetchImpl });
    c2.setField("email", "a@b.co");
    await vi.advanceTimersByTimeAsync(900);
    const last = second.calls[second.calls.length - 1];
    expect(last.body.token).toBeUndefined();
    expect(last.body.fields).toEqual({
      name: "Acked",
      city: "NYC",
      email: "a@b.co",
    });
  });

  it("resumes the same draft after a reload and flushes what was unacknowledged", async () => {
    const first = harness(
      () => new Response(JSON.stringify({ error: "down" }), { status: 500 }),
    );
    const c1 = new AutosaveController({ fetchImpl: first.fetchImpl });
    c1.setField("name", "Unsaved");
    await vi.advanceTimersByTimeAsync(900);

    const second = harness();
    new AutosaveController({ fetchImpl: second.fetchImpl });
    await vi.advanceTimersByTimeAsync(100);
    expect(second.calls[0].body.fields).toEqual({ name: "Unsaved" });
  });

  it("keeps working in memory when localStorage throws (in-app browsers)", async () => {
    const getSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });
    const setSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Still works");
    await vi.advanceTimersByTimeAsync(900);
    expect(calls[0].body.fields).toEqual({ name: "Still works" });
    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it("ignores corrupt persisted state instead of crashing the page", () => {
    window.localStorage.setItem("apply-draft-v2", "{not json");
    const { fetchImpl } = harness();
    expect(() => new AutosaveController({ fetchImpl })).not.toThrow();
  });
});

describe("AutosaveController: finalize after a lost response", () => {
  const finalized = () =>
    new Response(JSON.stringify({ error: "finalized" }), { status: 409 });

  it("treats a 409 finalized as already submitted and sends no new draft", async () => {
    // First finalize landed but its answer was lost; the retry gets a 409.
    const { calls, fetchImpl } = harness((_call, n) =>
      n === 1 ? ok() : finalized(),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Priya");
    await c.ensureDraft();
    const done = c.finalize();
    await vi.runAllTimersAsync();
    await expect(done).resolves.toMatchObject({ ok: true });
    expect(calls).toHaveLength(2);
    expect(c.hasDraft).toBe(false);
  });

  it("a second finalize after success sends nothing", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Priya");
    const first = c.finalize();
    await vi.runAllTimersAsync();
    await first;
    const sent = calls.length;
    await expect(c.finalize()).resolves.toMatchObject({ ok: true });
    expect(calls).toHaveLength(sent);
  });

  it("ensureDraft after the application is filed fails instead of minting a new draft", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Priya");
    const done = c.finalize();
    await vi.runAllTimersAsync();
    await done;
    const sent = calls.length;
    await expect(c.ensureDraft()).rejects.toMatchObject({
      stage: "save_draft",
    });
    expect(calls).toHaveLength(sent);
  });

  it("the background drain stops once the server says it is finalized", async () => {
    const { calls, fetchImpl } = harness((_call, n) =>
      n === 1 ? ok() : finalized(),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900);
    c.setField("name", "B");
    await vi.advanceTimersByTimeAsync(900);
    const sent = calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls).toHaveLength(sent);
  });
});

describe("AutosaveController: finalize", () => {
  it("sends finalize with every pending field and clears local state", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    const done = c.finalize();
    await vi.advanceTimersByTimeAsync(10);
    await done;
    // The sync request files the fields and proves the token is alive; the
    // finalize request then closes the application.
    expect(calls[0].body.finalize).toBeUndefined();
    expect(calls[0].body.fields).toEqual({ name: "A" });
    expect(calls[1].body.finalize).toBe(true);
    expect(window.localStorage.getItem("apply-draft-v2")).toBeNull();
    expect(c.hasDraft).toBe(false);
  });

  it("retries a failing finalize 3 times (1s then 2s, no wait after the last) then throws the real error", async () => {
    const { calls, fetchImpl } = harness(
      () =>
        new Response(JSON.stringify({ error: "Database unavailable" }), {
          status: 500,
        }),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    const result = c.finalize().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3_100);
    const err = (await result) as ApplyRequestError;
    expect(calls).toHaveLength(3);
    expect(err).toBeInstanceOf(ApplyRequestError);
    expect(err.message).toBe("save_draft: HTTP 500: Database unavailable");
  });

  it("a failed finalize leaves the fields queued so nothing is lost", async () => {
    const { fetchImpl } = harness(
      () => new Response(JSON.stringify({ error: "x" }), { status: 500 }),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    const result = c.finalize().catch(() => null);
    await vi.advanceTimersByTimeAsync(3_100);
    await result;
    const persisted = JSON.parse(
      window.localStorage.getItem("apply-draft-v2") ?? "{}",
    );
    expect(persisted.pending).toEqual({ name: "A" });
  });

  it("ignores edits after a successful finalize", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    const done = c.finalize();
    await vi.advanceTimersByTimeAsync(10);
    await done;
    c.setField("name", "late");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toHaveLength(2);
  });
});

describe("AutosaveController: leaving the page", () => {
  it("flushOnExit sends pending fields with keepalive", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Leaving");
    c.flushOnExit();
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toHaveLength(1);
    expect(calls[0].keepalive).toBe(true);
    expect(calls[0].body.fields).toEqual({ name: "Leaving" });
  });

  it("drops keepalive for a body over the browser's 64KB cap rather than failing", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("pitch", "p".repeat(70_000));
    c.flushOnExit();
    await vi.advanceTimersByTimeAsync(10);
    expect(calls[0].keepalive).toBe(false);
  });

  it("flushOnExit with nothing pending sends nothing", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.flushOnExit();
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toHaveLength(0);
  });
});

describe("AutosaveController.ensureDraft", () => {
  it("creates a draft on demand for the photo uploader and returns its token", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    const token = await c.ensureDraft();
    expect(token).toBe("tok-1");
    expect(calls).toHaveLength(1);
  });

  it("does not create a second draft when one exists", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    await c.ensureDraft();
    await c.ensureDraft();
    expect(calls).toHaveLength(1);
  });

  it("five photos picked at once on a fresh form share ONE draft", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    const tokens = await Promise.all(
      [1, 2, 3, 4, 5].map(() => c.ensureDraft()),
    );
    expect(calls).toHaveLength(1);
    expect(new Set(tokens).size).toBe(1);
  });

  it("a typed field racing a photo does not mint a second draft", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Priya");
    const photo = c.ensureDraft();
    await vi.advanceTimersByTimeAsync(1_000);
    await photo;
    expect(calls.filter((x) => x.body.token === undefined)).toHaveLength(1);
  });
});

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "invalid_token" }), {
    status: 401,
  });
}

describe("AutosaveController: revisions never fall behind the server", () => {
  it("persists the revision before the request leaves, so a reload mid-request cannot reuse it", async () => {
    let release: (r: Response) => void = () => {};
    const { fetchImpl } = harness(
      () => new Promise<Response>((resolve) => (release = resolve)),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900);
    const persisted = JSON.parse(
      window.localStorage.getItem("apply-draft-v2") ?? "{}",
    );
    expect(persisted.rev).toBe(1);
    release(ok());
  });

  it("adopts the server's highest revision and resends a field it refused as stale", async () => {
    const { calls, fetchImpl } = harness((call, n) =>
      n === 1
        ? ok({ stale: ["name"], maxRev: 40 })
        : ok({ maxRev: call.body.rev }),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "Mine");
    await vi.advanceTimersByTimeAsync(900);
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toHaveLength(2);
    expect(calls[1].body.fields).toEqual({ name: "Mine" });
    expect(calls[1].body.rev).toBeGreaterThan(40);
  });

  it("keeps text the server dropped for size queued and reports the cause", async () => {
    const onPersistentFailure = vi.fn();
    const { fetchImpl } = harness(() => ok({ capped: true }));
    const c = new AutosaveController({ fetchImpl, onPersistentFailure });
    c.setField("pitch", "long");
    await vi.advanceTimersByTimeAsync(900);
    await vi.advanceTimersByTimeAsync(60_000);
    const persisted = JSON.parse(
      window.localStorage.getItem("apply-draft-v2") ?? "{}",
    );
    expect(persisted.pending).toEqual({ pitch: "long" });
    expect(onPersistentFailure).toHaveBeenCalledTimes(1);
    expect(onPersistentFailure.mock.calls[0][0].detail).toMatch(/size limit/);
  });
});

describe("AutosaveController: a rejected token replaces the draft", () => {
  it("resetDraft is a no-op for a token that was already replaced", async () => {
    const { calls, fetchImpl } = harness();
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900);
    const before = c.epoch;
    c.resetDraft("some-other-token");
    expect(c.epoch).toBe(before);
    c.resetDraft("tok-1");
    c.resetDraft("tok-1");
    expect(c.epoch).toBe(before + 1);
    await vi.advanceTimersByTimeAsync(10);
    // One replacement draft, carrying every answer.
    const fresh = calls.filter((x) => x.body.token === undefined);
    expect(fresh).toHaveLength(2);
    expect(fresh[1].body.fields).toEqual({ name: "A" });
  });

  it("an ack for a draft replaced mid-request does not undo the replacement", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const { calls, fetchImpl } = harness(async (call, n) => {
      if (n === 2) await gate;
      return ok({ token: n === 2 ? "tok-old-ack" : "tok-1" });
    });
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900);
    c.setField("pitch", "typed during the request");
    await vi.advanceTimersByTimeAsync(900);
    expect(calls).toHaveLength(2);
    c.resetDraft("tok-1");
    release();
    await vi.advanceTimersByTimeAsync(10);
    expect(c.draftToken).not.toBe("tok-old-ack");
    const last = calls[calls.length - 1];
    expect(last.body.token).toBeUndefined();
    expect(last.body.fields).toMatchObject({
      name: "A",
      pitch: "typed during the request",
    });
  });

  it("a finalize ack for a draft replaced mid-request never marks the replacement filed", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    let finalizeCalls = 0;
    const { calls, fetchImpl } = harness(async (call, n) => {
      if (call.body.finalize === true) {
        finalizeCalls += 1;
        if (finalizeCalls === 1) await gate;
      }
      // A new draft token whenever the request carries no token, else echo it.
      return ok({ token: call.body.token ?? `tok-${n}` });
    });
    const c = new AutosaveController({ fetchImpl });
    await c.ensureDraft();
    const original = c.draftToken as string;
    const done = c.finalize(async () => {});
    await vi.advanceTimersByTimeAsync(10);
    c.resetDraft(original);
    release();
    await vi.advanceTimersByTimeAsync(10);
    await done;
    // The first finalize's ack belonged to the replaced draft; a second
    // finalize had to run against the replacement.
    const finalizes = calls.filter((x) => x.body.finalize === true);
    expect(finalizes).toHaveLength(2);
    expect(finalizes[1].body.token).not.toBe(original);
  });

  it("tells listeners after a 401 recovery so photos can be filed again", async () => {
    const { fetchImpl } = harness((call, n) =>
      call.body.token === "tok-1"
        ? unauthorized()
        : ok({ token: n === 1 ? "tok-1" : "tok-2" }),
    );
    const c = new AutosaveController({ fetchImpl });
    c.setField("name", "A");
    await vi.advanceTimersByTimeAsync(900);
    const onReset = vi.fn();
    c.onDraftReset(onReset);
    c.setField("name", "B");
    await vi.advanceTimersByTimeAsync(900);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(c.draftToken).toBe("tok-2");
    expect(c.epoch).toBe(1);
  });

  it("finalize re-settles photos when the draft is replaced mid-way, then finalizes the new draft", async () => {
    let expired = false;
    const { calls, fetchImpl } = harness((call, n) => {
      if (call.body.token === "tok-1" && expired) return unauthorized();
      return call.body.token === undefined
        ? ok({ token: n === 1 ? "tok-1" : "tok-2" })
        : ok({ token: call.body.token });
    });
    const c = new AutosaveController({ fetchImpl });
    await c.ensureDraft();
    expired = true;
    const settle = vi.fn(async () => {});
    const done = c.finalize(settle);
    await vi.advanceTimersByTimeAsync(10);
    await done;
    // Once before the token proved dead, once after photos were re-filed.
    expect(settle).toHaveBeenCalledTimes(2);
    const finalizeCall = calls.find((x) => x.body.finalize === true);
    expect(finalizeCall?.body.token).toBe("tok-2");
  });
});
