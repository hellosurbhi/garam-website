import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captureLead, updateLeadPhone } from "./leadSubmission";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("captureLead", () => {
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

describe("submission response validation and deadlines", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([{}, { ok: false }, { ok: true, id: "" }, { ok: true, id: 7 }])(
    "rejects malformed capture success %j",
    async (body) => {
      localStorage.clear();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(body));
      await expect(
        captureLead({ email: "fixture@example.com" }),
      ).rejects.toThrow("Could not confirm");
      expect(localStorage.getItem("gmd-popup-subscribed")).toBeNull();
    },
  );

  it("rejects a malformed update success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
    await expect(updateLeadPhone({ id: "lead" }, "5551234567")).rejects.toThrow(
      "Could not confirm",
    );
  });

  it("aborts a stalled signup after twenty seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Timed out", "AbortError")),
          );
        }),
    );
    const result = expect(
      captureLead({ email: "fixture@example.com" }),
    ).rejects.toThrow("Timed out");
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
  });

  it("keeps the deadline active while reading a stalled response body", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url, init) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () =>
                reject(new DOMException("Body timed out", "AbortError")),
              );
            }),
        }) as Response,
    );
    const result = expect(
      captureLead({ email: "fixture@example.com" }),
    ).rejects.toThrow("Body timed out");
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
  });
});
