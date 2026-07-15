import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startPortalStateLoad,
  resetPortalBootstrap,
  resolvePortalState,
  clearStoredPortalContext,
  PORTAL_CONTEXT_KEY,
  PORTAL_CONTEXT_EXPLICIT_KEY,
  type PortalContext,
  type PortalStateResult,
} from "@/lib/portalBootstrap";
import { PORTAL_LOAD_ERROR, missingRoleError } from "@/data/contestantPortal";

const EMAIL = "contact@garammasaladating.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function setSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: { search, pathname: "/contestant-portal" },
    writable: true,
    configurable: true,
  });
}

function storedContext(): PortalContext | null {
  const raw = sessionStorage.getItem(PORTAL_CONTEXT_KEY);
  return raw ? (JSON.parse(raw) as PortalContext) : null;
}

function seedContext(context: PortalContext, explicit = false) {
  sessionStorage.setItem(PORTAL_CONTEXT_KEY, JSON.stringify(context));
  if (explicit) sessionStorage.setItem(PORTAL_CONTEXT_EXPLICIT_KEY, "1");
}

describe("startPortalStateLoad", () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetPortalBootstrap();
    sessionStorage.clear();
    setSearch("");
    replaceStateSpy = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetPortalBootstrap();
    sessionStorage.clear();
  });

  it("is idempotent: concurrent callers share one fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "open" }));

    const [a, b] = await Promise.all([
      startPortalStateLoad(),
      startPortalStateLoad(),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a).toEqual({ kind: "ok", status: 200, data: { state: "open" } });
  });

  it("persists an explicit invite, scrubs the URL and queries with it", async () => {
    setSearch("?invite=abc123");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "invite", role: "female" }));

    await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state?invite=abc123",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(storedContext()).toEqual({ kind: "invite", id: "abc123" });
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/contestant-portal",
    );
  });

  it("persists an explicit show link the same way", async () => {
    setSearch("?show=new-york-city-2026-08-01");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "show" }));

    await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state?show=new-york-city-2026-08-01",
      expect.anything(),
    );
    expect(storedContext()).toEqual({
      kind: "show",
      id: "new-york-city-2026-08-01",
    });
    expect(replaceStateSpy).toHaveBeenCalled();
  });

  it("an explicit show link replaces a stored invite context", async () => {
    seedContext({ kind: "invite", id: "old-invite" });
    setSearch("?show=boston-2026-08-02");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "show" }));

    await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state?show=boston-2026-08-02",
      expect.anything(),
    );
    expect(storedContext()).toEqual({ kind: "show", id: "boston-2026-08-02" });
  });

  it("uses the stored context when the URL has no params", async () => {
    seedContext({ kind: "invite", id: "stored-77" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "invite", role: "male" }));

    await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state?invite=stored-77",
      expect.anything(),
    );
  });

  it("explicit URL invite wins over a stored context", async () => {
    seedContext({ kind: "invite", id: "stale-old" });
    setSearch("?invite=fresh-new");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "invite", role: "female" }));

    await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state?invite=fresh-new",
      expect.anything(),
    );
    expect(storedContext()).toEqual({ kind: "invite", id: "fresh-new" });
  });

  it("clears a STORED context on definitive rejection and retries bare once", async () => {
    seedContext({ kind: "invite", id: "claimed-1" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ state: "error", message: "already used" }),
      )
      .mockResolvedValueOnce(jsonResponse({ state: "active", role: "female" }));

    const result = await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      "/api/portal-state",
      expect.anything(),
    );
    expect(storedContext()).toBeNull();
    expect(result).toEqual({
      kind: "ok",
      status: 200,
      data: { state: "active", role: "female" },
    });
  });

  it("consumes the inline script's explicit flag: definitive rejection shows the error without a bare retry", async () => {
    // Simulates the real page flow: the inline head script already stored
    // the context, set the explicit flag and scrubbed the URL.
    seedContext({ kind: "invite", id: "dead-link" }, true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "error", message: "invalid" }));

    const result = await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storedContext()).toBeNull();
    expect(sessionStorage.getItem(PORTAL_CONTEXT_EXPLICIT_KEY)).toBeNull();
    expect(result).toEqual({
      kind: "ok",
      status: 200,
      data: { state: "error", message: "invalid" },
    });
  });

  it("the explicit flag is one-load only: it is consumed even on success", async () => {
    seedContext({ kind: "invite", id: "good" }, true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ state: "invite", role: "female" }),
    );

    await startPortalStateLoad();

    expect(sessionStorage.getItem(PORTAL_CONTEXT_EXPLICIT_KEY)).toBeNull();
    expect(storedContext()).toEqual({ kind: "invite", id: "good" });
  });

  it("preserves a stored context on a 500 and does not retry", async () => {
    seedContext({ kind: "invite", id: "keep-me" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    const result = await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storedContext()).toEqual({ kind: "invite", id: "keep-me" });
    expect(result.kind).toBe("ok");
  });

  it("preserves a stored context on a 429 and does not retry", async () => {
    seedContext({ kind: "invite", id: "keep-me" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ error: "slow down" }, 429));

    await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storedContext()).toEqual({ kind: "invite", id: "keep-me" });
  });

  it("preserves a stored context on network failure and resolves failed", async () => {
    seedContext({ kind: "invite", id: "keep-me" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    const result = await startPortalStateLoad();

    expect(result).toEqual({ kind: "failed" });
    expect(storedContext()).toEqual({ kind: "invite", id: "keep-me" });
  });

  it("treats non-object JSON bodies as empty payloads instead of rejecting", async () => {
    seedContext({ kind: "invite", id: "keep-me" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("null", { status: 200 }),
    );

    const result = await startPortalStateLoad();

    // "null" parses to null; a property read on it inside run() would have
    // rejected the never-rejects promise and stranded the skeleton.
    expect(result).toEqual({ kind: "ok", status: 200, data: {} });
    expect(storedContext()).toEqual({ kind: "invite", id: "keep-me" });
  });

  it("clears the stored copy of an EXPLICIT URL invite on definitive rejection without retrying", async () => {
    setSearch("?invite=dead-link");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "error", message: "invalid" }));

    const result = await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storedContext()).toBeNull();
    expect(result).toEqual({
      kind: "ok",
      status: 200,
      data: { state: "error", message: "invalid" },
    });
  });

  it("ignores malformed stored context values", async () => {
    sessionStorage.setItem(PORTAL_CONTEXT_KEY, '{"kind":"nonsense"}');
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "open" }));

    await startPortalStateLoad();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state",
      expect.anything(),
    );
  });

  it("resolves failed when the request exceeds the deadline", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const promise = startPortalStateLoad();
    await vi.advanceTimersByTimeAsync(12_000);

    await expect(promise).resolves.toEqual({ kind: "failed" });
  });

  it("the bare retry shares the original 12s budget instead of stacking a fresh one", async () => {
    vi.useFakeTimers();
    seedContext({ kind: "invite", id: "slow-then-dead" });
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      calls += 1;
      if (calls === 1) {
        // Definitive rejection lands with almost no budget left.
        return new Promise<Response>((resolve) => {
          setTimeout(
            () => resolve(jsonResponse({ state: "error", message: "gone" })),
            11_500,
          );
        });
      }
      // The retry never resolves on its own; only its abort settles it.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });

    const promise = startPortalStateLoad();
    // A fresh 12s retry budget would keep this pending until ~23.5s. The
    // shared budget aborts the retry at the original 12s mark, so the
    // promise must already be settled here.
    await vi.advanceTimersByTimeAsync(12_100);
    const result = await promise;

    expect(calls).toBe(2);
    expect(result).toEqual({ kind: "failed" });
  });

  it("resolves failed instead of rejecting when history.replaceState throws", async () => {
    setSearch("?invite=whatever");
    replaceStateSpy.mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ state: "open" }),
    );

    await expect(startPortalStateLoad()).resolves.toEqual({ kind: "failed" });
  });

  it("consumes a window-parked context from the inline script when storage was unavailable", async () => {
    // The inline script scrubs the URL unconditionally and parks the context
    // on window when its sessionStorage writes threw.
    window.__portalCtx = { kind: "invite", id: "parked-42" };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "error", message: "invalid" }));

    const result = await startPortalStateLoad();

    // Treated as explicit: the dead link's error is shown, no bare retry.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state?invite=parked-42",
      expect.anything(),
    );
    expect(window.__portalCtx).toBeUndefined();
    expect(result).toEqual({
      kind: "ok",
      status: 200,
      data: { state: "error", message: "invalid" },
    });
  });

  it("falls back to in-memory context storage when sessionStorage throws", async () => {
    setSearch("?invite=private-mode");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ state: "invite", role: "female", inviteId: "x" }),
      );

    // Does not throw, still queries with the URL invite despite storage
    // being unusable; the context survives in the in-memory fallback.
    const result = await startPortalStateLoad();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/portal-state?invite=private-mode",
      expect.anything(),
    );
    expect(result.kind).toBe("ok");
  });

  it("clearStoredPortalContext empties the slot", async () => {
    setSearch("?invite=to-clear");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ state: "invite", role: "female" }),
    );
    await startPortalStateLoad();
    expect(storedContext()).toEqual({ kind: "invite", id: "to-clear" });

    clearStoredPortalContext();
    expect(storedContext()).toBeNull();

    resetPortalBootstrap();
    setSearch("");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ state: "open" }));
    await startPortalStateLoad();
    expect(fetchSpy).toHaveBeenLastCalledWith(
      "/api/portal-state",
      expect.anything(),
    );
  });
});

describe("resolvePortalState", () => {
  const ok = (data: Record<string, unknown>, status = 200): PortalStateResult =>
    ({ kind: "ok", status, data }) as PortalStateResult;

  it("maps failed to the generic error", () => {
    expect(resolvePortalState({ kind: "failed" }, EMAIL)).toEqual({
      type: "error",
      message: PORTAL_LOAD_ERROR,
    });
  });

  it("maps non-2xx to an error with the server message", () => {
    expect(
      resolvePortalState(ok({ error: "Invalid invite link." }, 404), EMAIL),
    ).toEqual({ type: "error", message: "Invalid invite link." });
  });

  it("maps non-2xx without a body message to the generic error", () => {
    expect(resolvePortalState(ok({}, 502), EMAIL)).toEqual({
      type: "error",
      message: PORTAL_LOAD_ERROR,
    });
  });

  it("maps open and no-access to open", () => {
    expect(resolvePortalState(ok({ state: "open" }), EMAIL)).toEqual({
      type: "open",
    });
    expect(resolvePortalState(ok({ state: "no-access" }), EMAIL)).toEqual({
      type: "open",
    });
  });

  it("maps invite with a valid role", () => {
    expect(
      resolvePortalState(
        ok({
          state: "invite",
          inviteId: "i1",
          showCity: "NYC",
          showDate: "2026-08-01",
          showDisplayDate: "Aug 1",
          startTime: "19:30",
          venueName: "The Venue",
          role: "female",
        }),
        EMAIL,
      ),
    ).toEqual({
      type: "invite",
      inviteId: "i1",
      showCity: "NYC",
      showDate: "2026-08-01",
      showDisplayDate: "Aug 1",
      startTime: "19:30",
      venueName: "The Venue",
      role: "female",
    });
  });

  it("maps invite with a missing or unknown role to the missing-role error", () => {
    expect(
      resolvePortalState(ok({ state: "invite", role: null }), EMAIL),
    ).toEqual({ type: "error", message: missingRoleError(EMAIL) });
    expect(
      resolvePortalState(ok({ state: "invite", role: "spectator" }), EMAIL),
    ).toEqual({ type: "error", message: missingRoleError(EMAIL) });
  });

  it("maps show with defaults for missing fields", () => {
    expect(resolvePortalState(ok({ state: "show" }), EMAIL)).toEqual({
      type: "show",
      showId: "",
      showCity: "",
      showDate: "",
      showDisplayDate: undefined,
      startTime: null,
      venueName: null,
    });
  });

  it("maps active with a valid role", () => {
    expect(
      resolvePortalState(
        ok({ state: "active", role: "male", firstName: "Dev" }),
        EMAIL,
      ),
    ).toMatchObject({ type: "active", role: "male", firstName: "Dev" });
  });

  it("maps active with a missing role to open", () => {
    expect(
      resolvePortalState(ok({ state: "active", role: null }), EMAIL),
    ).toEqual({ type: "open" });
  });

  it("maps expired", () => {
    expect(resolvePortalState(ok({ state: "expired" }), EMAIL)).toEqual({
      type: "expired",
    });
  });

  it("maps a server error state with its message", () => {
    expect(
      resolvePortalState(
        ok({ state: "error", message: "already used" }),
        EMAIL,
      ),
    ).toEqual({ type: "error", message: "already used" });
  });

  it("maps a server error state without a message to the generic error", () => {
    expect(resolvePortalState(ok({ state: "error" }), EMAIL)).toEqual({
      type: "error",
      message: PORTAL_LOAD_ERROR,
    });
  });

  it("maps an unknown state and a malformed empty body to the generic error", () => {
    expect(resolvePortalState(ok({ state: "surprise" }), EMAIL)).toEqual({
      type: "error",
      message: PORTAL_LOAD_ERROR,
    });
    expect(resolvePortalState(ok({}), EMAIL)).toEqual({
      type: "error",
      message: PORTAL_LOAD_ERROR,
    });
  });
});
