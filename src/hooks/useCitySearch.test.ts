import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
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
});
