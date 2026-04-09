import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLoadCityOptions = vi.fn();
const mockResolveCityOption = vi.fn();
const mockSearchCityOptions = vi.fn();

vi.mock("@/lib/citySearch", () => ({
  loadCityOptions: (...args: unknown[]) => mockLoadCityOptions(...args),
  resolveCityOption: (...args: unknown[]) => mockResolveCityOption(...args),
  searchCityOptions: (...args: unknown[]) => mockSearchCityOptions(...args),
}));

import { GET } from "./city-search";

function makeRequest(query?: string): Request {
  const url = query
    ? `https://localhost/api/city-search?q=${encodeURIComponent(query)}`
    : "https://localhost/api/city-search";
  return new Request(url);
}

const OPTION_A = {
  value: "A City, ST, US",
  label: "A City, ST, US",
  city: "A City",
  state: "ST",
  country: "US",
  countryCode: "US",
  searchText: "a city st us",
  boost: 40,
};

const OPTION_B = {
  value: "B City, ST, US",
  label: "B City, ST, US",
  city: "B City",
  state: "ST",
  country: "US",
  countryCode: "US",
  searchText: "b city st us",
  boost: 20,
};

describe("GET /api/city-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCityOptions.mockResolvedValue([OPTION_A, OPTION_B]);
    mockResolveCityOption.mockReturnValue(null);
    mockSearchCityOptions.mockReturnValue([OPTION_A, OPTION_B]);
  });

  it("returns empty results for missing q param", async () => {
    const response = await GET({ request: makeRequest() } as never);
    const data = await response.json();
    expect(data.results).toEqual([]);
    expect(response.status).toBe(200);
  });

  it("returns empty results for empty q param", async () => {
    const response = await GET({ request: makeRequest("") } as never);
    const data = await response.json();
    expect(data.results).toEqual([]);
  });

  it("returns empty results for whitespace-only q param", async () => {
    const response = await GET({ request: makeRequest("   ") } as never);
    const data = await response.json();
    expect(data.results).toEqual([]);
  });

  it("returns search results when no exact match found", async () => {
    mockResolveCityOption.mockReturnValue(null);
    mockSearchCityOptions.mockReturnValue([OPTION_A]);

    const response = await GET({ request: makeRequest("A City") } as never);
    const data = await response.json();
    expect(data.results).toEqual([OPTION_A]);
    expect(response.status).toBe(200);
  });

  it("places exact match first and deduplicates from search results", async () => {
    mockResolveCityOption.mockReturnValue(OPTION_A);
    mockSearchCityOptions.mockReturnValue([OPTION_A, OPTION_B]);

    const response = await GET({ request: makeRequest("A City") } as never);
    const data = await response.json();
    // OPTION_A is exact match (first), OPTION_B from search, OPTION_A deduplicated
    expect(data.results[0]).toEqual(OPTION_A);
    expect(
      data.results.filter((r: typeof OPTION_A) => r.value === OPTION_A.value),
    ).toHaveLength(1);
  });

  it("exact match appears at index 0", async () => {
    mockResolveCityOption.mockReturnValue(OPTION_B);
    mockSearchCityOptions.mockReturnValue([OPTION_A]);

    const response = await GET({ request: makeRequest("B City") } as never);
    const data = await response.json();
    expect(data.results[0].city).toBe("B City");
  });

  it("limits results to 5 when exact match present", async () => {
    const manyOptions = Array.from({ length: 10 }, (_, i) => ({
      ...OPTION_A,
      value: `City${i}`,
      city: `City${i}`,
    }));
    mockResolveCityOption.mockReturnValue(OPTION_B);
    mockSearchCityOptions.mockReturnValue(manyOptions);

    const response = await GET({ request: makeRequest("City") } as never);
    const data = await response.json();
    // exact + search results, sliced to 5
    expect(data.results).toHaveLength(5);
    expect(data.results[0]).toEqual(OPTION_B); // exact first
  });

  it("returns 500 when loadCityOptions throws", async () => {
    mockLoadCityOptions.mockRejectedValue(new Error("DB error"));

    const response = await GET({ request: makeRequest("test") } as never);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to search cities");
  });

  it("response has Content-Type application/json", async () => {
    const response = await GET({ request: makeRequest("test") } as never);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("calls loadCityOptions before searching", async () => {
    await GET({ request: makeRequest("test") } as never);
    expect(mockLoadCityOptions).toHaveBeenCalledTimes(1);
  });

  it("passes query to resolveCityOption and searchCityOptions", async () => {
    await GET({ request: makeRequest("hello") } as never);
    expect(mockResolveCityOption).toHaveBeenCalledWith(
      "hello",
      expect.anything(),
    );
    expect(mockSearchCityOptions).toHaveBeenCalledWith(
      "hello",
      expect.anything(),
      5,
    );
  });
});
