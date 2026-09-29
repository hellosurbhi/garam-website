import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captureLead, updateLeadPhone } from "./leadSubmission";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("captureLead", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("returns id and updateToken from the API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ ok: true, id: "lead123", updateToken: "tok" }),
    );

    const result = await captureLead({ email: "a@b.com" });
    expect(result).toEqual({ id: "lead123", updateToken: "tok" });
    expect(localStorage.getItem("gmd-popup-subscribed")).toBe("true");
  });

  it("omits updateToken when the API does not send one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ ok: true, id: "lead123" }),
    );

    const result = await captureLead({ email: "a@b.com" });
    expect(result).toEqual({ id: "lead123" });
    expect("updateToken" in result).toBe(false);
  });

  it("throws the API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Valid email required" }, 400),
    );

    await expect(captureLead({ email: "bad" })).rejects.toThrow(
      "Valid email required",
    );
    expect(localStorage.getItem("gmd-popup-subscribed")).toBeNull();
  });

  it.each([{ ok: true }, { ok: false, id: "lead123" }, { ok: true, id: 123 }])(
    "does not mark a malformed success response as subscribed: %j",
    async (body) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(body));
      await expect(captureLead({ email: "a@b.com" })).rejects.toThrow(
        "Could not confirm",
      );
      expect(localStorage.getItem("gmd-popup-subscribed")).toBeNull();
    },
  );

  it("rejects an HTML response instead of showing a false success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>Offline</html>"),
    );
    await expect(captureLead({ email: "a@b.com" })).rejects.toThrow(
      "Could not confirm",
    );
  });

  it("aborts a stalled request so the form can leave its loading state", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const result = expect(captureLead({ email: "a@b.com" })).rejects.toThrow(
      "connection timed out",
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
    expect(localStorage.getItem("gmd-popup-subscribed")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("updateLeadPhone", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends id, token and phone", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }));

    await updateLeadPhone({ id: "lead123", updateToken: "tok" }, "5551234567");

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      id: "lead123",
      token: "tok",
      phone: "5551234567",
    });
  });

  it("omits token when the lead has none", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }));

    await updateLeadPhone({ id: "lead123" }, "5551234567");

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      id: "lead123",
      phone: "5551234567",
    });
  });

  it("throws when the lead has no id", async () => {
    await expect(updateLeadPhone({ id: "" }, "5551234567")).rejects.toThrow(
      "Lead id required",
    );
  });

  it("throws the API error message on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Invalid or expired update token" }, 401),
    );

    await expect(
      updateLeadPhone({ id: "lead123", updateToken: "stale" }, "5551234567"),
    ).rejects.toThrow("Invalid or expired update token");
  });
});
