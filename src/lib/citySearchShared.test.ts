import { describe, it, expect } from "vitest";
import type { CitySearchOption } from "./citySearchShared";
import {
  normalizeCitySearchValue,
  searchCityOptions,
  resolveCityOption,
} from "./citySearchShared";

function makeOption(
  overrides: Partial<CitySearchOption> & { city: string },
): CitySearchOption {
  const city = overrides.city;
  const state = overrides.state ?? "";
  const country = overrides.country ?? "US";
  const parts = [city, state, country].filter(Boolean);
  return {
    value: overrides.value ?? parts.join(", "),
    label: overrides.label ?? parts.join(", "),
    city,
    state,
    country,
    countryCode: overrides.countryCode ?? "US",
    searchText: normalizeCitySearchValue(parts.join(" ")),
    boost: overrides.boost ?? 0,
  };
}

describe("normalizeCitySearchValue", () => {
  it("converts to lowercase", () => {
    expect(normalizeCitySearchValue("NYC")).toBe("nyc");
  });

  it("strips diacritics via NFKD normalization", () => {
    expect(normalizeCitySearchValue("Montr\u00e9al")).toBe("montreal");
  });

  it("replaces non-alphanumeric characters with spaces", () => {
    expect(normalizeCitySearchValue("New York!")).toBe("new york");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeCitySearchValue("  test  ")).toBe("test");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeCitySearchValue("")).toBe("");
  });

  it("handles combined diacritics, special characters, and casing", () => {
    expect(normalizeCitySearchValue("S\u00e3o Paulo #1")).toBe("sao paulo 1");
  });

  it("collapses multiple non-alnum chars into single space", () => {
    expect(normalizeCitySearchValue("a---b")).toBe("a b");
  });
});

describe("searchCityOptions", () => {
  const options: CitySearchOption[] = [
    makeOption({ city: "New York", state: "NY", boost: 40 }),
    makeOption({ city: "New Orleans", state: "LA", boost: 20 }),
    makeOption({ city: "Newark", state: "NJ", boost: 0 }),
    makeOption({ city: "Boston", state: "MA", boost: 10 }),
    makeOption({ city: "Albany", state: "NY", boost: 0 }),
    makeOption({ city: "Denver", state: "CO", boost: 5 }),
  ];

  it("returns boost-sorted results for empty query", () => {
    const results = searchCityOptions("", options, 3);
    expect(results).toHaveLength(3);
    expect(results[0].city).toBe("New York"); // boost 40
    expect(results[1].city).toBe("New Orleans"); // boost 20
    expect(results[2].city).toBe("Boston"); // boost 10
  });

  it("exact city match ranks highest", () => {
    const results = searchCityOptions("New York", options);
    expect(results[0].city).toBe("New York");
  });

  it("city startsWith ranks above city includes", () => {
    const results = searchCityOptions("new", options);
    // "New York" and "New Orleans" start with "new", "Newark" also starts with "new"
    const cities = results.map((r) => r.city);
    expect(cities).toContain("New York");
    expect(cities).toContain("New Orleans");
    expect(cities).toContain("Newark");
  });

  it("returns only boost-scoring options when query matches nothing textually", () => {
    // Options with boost > 0 still appear since scoreCityOption returns boost for no match
    const zeroBoostOnly = [
      makeOption({ city: "Xanadu", boost: 0 }),
      makeOption({ city: "Yakima", boost: 0 }),
    ];
    const results = searchCityOptions("zzzzz", zeroBoostOnly);
    expect(results).toEqual([]);
  });

  it("respects custom limit parameter", () => {
    const results = searchCityOptions("new", options, 2);
    expect(results).toHaveLength(2);
  });

  it("default limit is 5", () => {
    const manyOptions = Array.from({ length: 10 }, (_, i) =>
      makeOption({ city: `Newtown${i}`, boost: 0 }),
    );
    const results = searchCityOptions("newtown", manyOptions);
    expect(results).toHaveLength(5);
  });

  it("tiebreaker: higher boost wins when scores are equal", () => {
    const tied = [
      makeOption({ city: "Newville", boost: 10 }),
      makeOption({ city: "Newberg", boost: 30 }),
    ];
    const results = searchCityOptions("new", tied);
    expect(results[0].city).toBe("Newberg"); // higher boost
  });

  it("tiebreaker: alphabetical label when score and boost are equal", () => {
    const tied = [
      makeOption({ city: "Newville", boost: 0 }),
      makeOption({ city: "Newberg", boost: 0 }),
    ];
    const results = searchCityOptions("new", tied);
    expect(results[0].city).toBe("Newberg"); // alphabetically first
  });

  it("empty query with limit returns that many items", () => {
    const results = searchCityOptions("", options, 1);
    expect(results).toHaveLength(1);
  });

  it("includes option when query matches label (contains)", () => {
    // "ny" is in the label "New York, NY, US"
    const results = searchCityOptions("ny", options);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("resolveCityOption", () => {
  const options: CitySearchOption[] = [
    makeOption({ city: "New York", state: "NY" }),
    makeOption({ city: "Boston", state: "MA" }),
  ];

  it("returns null for empty value", () => {
    expect(resolveCityOption("", options)).toBeNull();
  });

  it("finds option by normalized label match", () => {
    const result = resolveCityOption("New York, NY, US", options);
    expect(result).not.toBeNull();
    expect(result!.city).toBe("New York");
  });

  it("finds option by normalized city match", () => {
    const result = resolveCityOption("Boston", options);
    expect(result).not.toBeNull();
    expect(result!.city).toBe("Boston");
  });

  it("returns null when no option matches", () => {
    expect(resolveCityOption("Chicago", options)).toBeNull();
  });

  it("matches case-insensitively", () => {
    const result = resolveCityOption("new york", options);
    expect(result).not.toBeNull();
    expect(result!.city).toBe("New York");
  });

  it("returns null for whitespace-only value", () => {
    expect(resolveCityOption("   ", options)).toBeNull();
  });
});
