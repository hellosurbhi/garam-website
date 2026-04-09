import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockTrackError = vi.fn();
vi.mock("@/lib/analytics", () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import { useCitySearch } from "./useCitySearch";

function mockFetchSuccess(results: unknown[] = []) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ results }), { status: 200 }),
  );
}

function mockFetchError() {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
}

function mockFetchNon200() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("Not Found", { status: 404 }),
  );
}

const MOCK_RESULTS = [
  {
    value: "New York, NY, US",
    label: "New York, NY, US",
    city: "New York",
    state: "NY",
    country: "US",
    countryCode: "US",
    searchText: "new york ny us",
    boost: 40,
  },
];

describe("useCitySearch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockTrackError.mockClear();
  });

  it("has correct initial state", () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useCitySearch(""));
    expect(result.current.options).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it("resets to empty state when shouldLoad is false", async () => {
    mockFetchSuccess(MOCK_RESULTS);
    const { result } = renderHook(() => useCitySearch("new york", false));
    await waitFor(() => {
      expect(result.current.options).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.failed).toBe(false);
    });
  });

  it("resets to empty state when query is empty", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useCitySearch(""));
    await waitFor(() => {
      expect(result.current.options).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  it("resets to empty state when query is whitespace-only", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useCitySearch("   "));
    await waitFor(() => {
      expect(result.current.options).toEqual([]);
    });
  });

  it("fetches and sets options after debounce", async () => {
    mockFetchSuccess(MOCK_RESULTS);
    const { result } = renderHook(() => useCitySearch("new york"));

    await waitFor(() => {
      expect(result.current.options).toHaveLength(1);
    });

    expect(result.current.options[0].city).toBe("New York");
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it("calls fetch with encoded query parameter", async () => {
    mockFetchSuccess(MOCK_RESULTS);
    renderHook(() => useCitySearch("new york"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/city-search?q=new%20york",
    );
  });

  it("sets failed to true on network error", async () => {
    mockFetchError();
    const { result } = renderHook(() => useCitySearch("new york"));

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.loading).toBe(false);
  });

  it("sets failed to true on non-200 response", async () => {
    mockFetchNon200();
    const { result } = renderHook(() => useCitySearch("new york"));

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.loading).toBe(false);
  });

  it("returns empty array when API response has no results field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const { result } = renderHook(() => useCitySearch("new york"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    expect(result.current.options).toEqual([]);
  });

  it("retry triggers a new fetch", async () => {
    mockFetchError();
    const { result } = renderHook(() => useCitySearch("new york"));

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });

    // Now mock success and retry
    vi.restoreAllMocks();
    mockFetchSuccess(MOCK_RESULTS);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.failed).toBe(false);
      expect(result.current.options).toHaveLength(1);
    });
  });

  it("provides retry as a stable function", () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useCitySearch("test"));
    expect(typeof result.current.retry).toBe("function");
  });

  it("shouldLoad=false with non-empty query does NOT call fetch", async () => {
    mockFetchSuccess(MOCK_RESULTS);
    renderHook(() => useCitySearch("new york", false));
    // Wait a bit to ensure debounce would have fired
    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  it("sets loading to true during fetch", async () => {
    let resolveResponse!: (value: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const { result } = renderHook(() => useCitySearch("test query"));

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Resolve the fetch
    resolveResponse(
      new Response(JSON.stringify({ results: MOCK_RESULTS }), { status: 200 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  /* ── trackError on failure ───────────────────────────── */

  it("calls trackError with correct fields on network error", async () => {
    mockFetchError();
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: "Network error",
          error_type: "api_error",
          component: "useCitySearch",
          api_endpoint: "/api/city-search",
        }),
      );
    });
  });

  it("calls trackError with error_stack on failure", async () => {
    mockFetchError();
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_stack: expect.any(String),
        }),
      );
    });
  });

  it("calls trackError with 'Failed to search cities' on non-200", async () => {
    mockFetchNon200();
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: "Failed to search cities",
        }),
      );
    });
  });

  it("handles non-Error thrown by wrapping in Error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue("string error");
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: "string error",
        }),
      );
    });
  });

  /* ── Debounce behavior ───────────────────────────────── */

  it("does not fetch before debounce period", () => {
    vi.useFakeTimers();
    mockFetchSuccess(MOCK_RESULTS);
    renderHook(() => useCitySearch("test"));

    vi.advanceTimersByTime(100); // Less than 120ms debounce
    expect(globalThis.fetch).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("fetches after debounce period of 120ms", async () => {
    vi.useFakeTimers();
    mockFetchSuccess(MOCK_RESULTS);
    renderHook(() => useCitySearch("test"));

    vi.advanceTimersByTime(120);
    expect(globalThis.fetch).toHaveBeenCalled();

    vi.useRealTimers();
  });

  /* ── Cancellation ────────────────────────────────────── */

  it("does not update state after unmount", async () => {
    let resolveResponse!: (value: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    unmount();

    // Resolve after unmount — should not throw
    resolveResponse(
      new Response(JSON.stringify({ results: MOCK_RESULTS }), { status: 200 }),
    );
  });

  /* ── Reset clears failed state ───────────────────────── */

  it("clearing query resets failed state", async () => {
    mockFetchError();
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useCitySearch(q),
      { initialProps: { q: "test" } },
    );

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });

    vi.restoreAllMocks();
    mockFetchSuccess();
    rerender({ q: "" });

    await waitFor(() => {
      expect(result.current.failed).toBe(false);
      expect(result.current.options).toEqual([]);
    });
  });

  /* ── URL encoding ────────────────────────────────────── */

  it("encodes special characters in query", async () => {
    mockFetchSuccess();
    renderHook(() => useCitySearch("São Paulo"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `/api/city-search?q=${encodeURIComponent("São Paulo")}`,
      );
    });
  });

  /* ── Retry increments attempt ────────────────────────── */

  it("retry function is stable across renders", () => {
    mockFetchSuccess();
    const { result, rerender } = renderHook(() => useCitySearch("test"));
    const firstRetry = result.current.retry;
    rerender();
    expect(result.current.retry).toBe(firstRetry);
  });

  /* ── shouldLoad default parameter ────────────────────── */

  it("shouldLoad defaults to true", async () => {
    mockFetchSuccess(MOCK_RESULTS);
    const { result } = renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(result.current.options).toHaveLength(1);
    });
  });

  /* ── Error stack truncation ──────────────────────────── */

  it("truncates error stack to 2000 characters", async () => {
    const longStackError = new Error("test");
    longStackError.stack = "x".repeat(3000);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(longStackError);
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      const call = mockTrackError.mock.calls[0][0];
      expect(call.error_stack.length).toBe(2000);
    });
  });

  it("returns empty array when API response results is null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: null }), { status: 200 }),
    );
    const { result } = renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    expect(result.current.options).toEqual([]);
  });

  it("error_stack is empty string when error has no stack property", async () => {
    const noStackError = new Error("no stack");
    delete noStackError.stack;
    vi.spyOn(globalThis, "fetch").mockRejectedValue(noStackError);
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      const call = mockTrackError.mock.calls[0][0];
      expect(call.error_stack).toBe("");
    });
  });

  it("wraps thrown number in new Error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(42);
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({ error_message: "42" }),
      );
    });
  });

  it("wraps thrown null in new Error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(null);
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({ error_message: "null" }),
      );
    });
  });

  it("wraps thrown object in new Error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue({ msg: "oops" });
    renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: "[object Object]",
        }),
      );
    });
  });

  it("does not fetch at 119ms (one ms before debounce)", () => {
    vi.useFakeTimers();
    mockFetchSuccess(MOCK_RESULTS);
    renderHook(() => useCitySearch("test"));

    vi.advanceTimersByTime(119);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("options are completely replaced on new fetch, not merged", async () => {
    mockFetchSuccess([
      { ...MOCK_RESULTS[0], city: "Boston", value: "Boston, MA, US" },
    ]);
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useCitySearch(q),
      { initialProps: { q: "boston" } },
    );

    await waitFor(() => {
      expect(result.current.options).toHaveLength(1);
      expect(result.current.options[0].city).toBe("Boston");
    });

    vi.restoreAllMocks();
    mockFetchSuccess(MOCK_RESULTS);
    rerender({ q: "new york" });

    await waitFor(() => {
      expect(result.current.options).toHaveLength(1);
      expect(result.current.options[0].city).toBe("New York");
    });
  });

  it("loading is set to false after error", async () => {
    mockFetchError();
    const { result } = renderHook(() => useCitySearch("test"));

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.loading).toBe(false);
  });
});
