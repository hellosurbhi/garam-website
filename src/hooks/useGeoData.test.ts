import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGeoData } from "./useGeoData";

const mockCountries = [
  { isoCode: "US", name: "United States" },
  { isoCode: "IN", name: "India" },
];
const mockStates = [
  { isoCode: "NY", name: "New York" },
  { isoCode: "CA", name: "California" },
];
const mockCities = [
  { name: "New York City" },
  { name: "Buffalo" },
];

vi.mock("country-state-city", () => ({
  Country: { getAllCountries: () => mockCountries },
  State: { getStatesOfCountry: () => mockStates },
  City: { getCitiesOfState: () => mockCities },
}));

describe("useGeoData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns loading true initially", () => {
    const { result } = renderHook(() => useGeoData("", ""));
    expect(result.current.loading).toBe(true);
  });

  it("returns loading false after module loads", async () => {
    const { result } = renderHook(() => useGeoData("US", "NY"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("returns country options after loading", async () => {
    const { result } = renderHook(() => useGeoData("US", "NY"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.countryOptions).toEqual([
      { value: "US", label: "United States" },
      { value: "IN", label: "India" },
    ]);
  });

  it("returns state options when countryCode is provided", async () => {
    const { result } = renderHook(() => useGeoData("US", "NY"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stateOptions).toEqual([
      { value: "NY", label: "New York" },
      { value: "CA", label: "California" },
    ]);
  });

  it("returns empty state options when countryCode is empty", async () => {
    const { result } = renderHook(() => useGeoData("", ""));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.stateOptions).toEqual([]);
  });

  it("returns city options when both countryCode and stateCode are provided", async () => {
    const { result } = renderHook(() => useGeoData("US", "NY"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.cityOptions).toEqual([
      { value: "New York City", label: "New York City" },
      { value: "Buffalo", label: "Buffalo" },
    ]);
  });

  it("returns empty city options when stateCode is empty", async () => {
    const { result } = renderHook(() => useGeoData("US", ""));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.cityOptions).toEqual([]);
  });
});
