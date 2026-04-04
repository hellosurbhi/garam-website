import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("country-state-city", () => {
  return Promise.reject(new Error("chunk load failed"));
});

describe("useGeoData – import failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stops loading and returns empty options when dynamic import rejects", async () => {
    const { useGeoData } = await import("./useGeoData");
    const { result } = renderHook(() => useGeoData("US", "NY"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.countryOptions).toEqual([]);
    expect(result.current.stateOptions).toEqual([]);
    expect(result.current.cityOptions).toEqual([]);
  });
});
