import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCapiEvent } from "@/lib/capi";

const params = {
  eventName: "Purchase" as const,
  eventId: "order-1",
  eventTime: 1_700_000_000,
  eventSourceUrl: "https://garammasaladating.com/events/x",
  userData: { email: "a@b.com" },
};

function stubFetch(status: number, body: unknown = "nope"): void {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(text, { status })),
  );
}

describe("sendCapiEvent failure classification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("marks a Meta invalid-parameter rejection as terminal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(400, { error: { code: 100 } });
    expect(await sendCapiEvent(params, "tok")).toMatchObject({
      ok: false,
      terminal: true,
      credential: false,
    });
  });

  it("keeps a transient-flagged 400 retryable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(400, { error: { code: 100, is_transient: true } });
    expect(await sendCapiEvent(params, "tok")).toMatchObject({
      terminal: false,
    });
  });

  it("classifies an expired token (HTTP 400, code 190) as a credential failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(400, { error: { code: 190 } });
    expect(await sendCapiEvent(params, "tok")).toMatchObject({
      terminal: false,
      credential: true,
    });
  });

  it.each([401, 403])(
    "classifies HTTP %i as a credential failure",
    async (status) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      stubFetch(status);
      expect(await sendCapiEvent(params, "tok")).toMatchObject({
        terminal: false,
        credential: true,
      });
    },
  );

  it.each([408, 429, 500, 503])("keeps HTTP %i retryable", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(status);
    expect(await sendCapiEvent(params, "tok")).toMatchObject({
      ok: false,
      terminal: false,
    });
  });

  it("treats a network failure as retryable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
    const result = await sendCapiEvent(params, "tok");
    expect(result.ok).toBe(false);
    expect(result.terminal).toBeUndefined();
  });
});
