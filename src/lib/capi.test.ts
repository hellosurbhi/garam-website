import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCapiEvent } from "@/lib/capi";

const params = {
  eventName: "Purchase" as const,
  eventId: "order-1",
  eventTime: 1_700_000_000,
  eventSourceUrl: "https://garammasaladating.com/events/x",
  userData: { email: "a@b.com" },
};

function stubFetch(status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("nope", { status })),
  );
}

describe("sendCapiEvent failure classification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([400, 403])("marks HTTP %i as terminal", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(status);
    expect(await sendCapiEvent(params, "tok")).toMatchObject({
      ok: false,
      terminal: true,
    });
  });

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
