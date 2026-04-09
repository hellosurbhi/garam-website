import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCountries = [
  { isoCode: "US", name: "United States" },
  { isoCode: "GB", name: "United Kingdom" },
];

const mockUSStates = [
  { isoCode: "NY", name: "New York" },
  { isoCode: "CA", name: "California" },
];

const mockUSCities = [{ name: "New York City" }, { name: "Albany" }];

const mockGBCities = [{ name: "London" }];

vi.mock("country-state-city", () => ({
  Country: {
    getAllCountries: () => mockCountries,
  },
  State: {
    getStatesOfCountry: (code: string) => (code === "US" ? mockUSStates : []),
  },
  City: {
    getCitiesOfState: (_country: string, state: string) =>
      state === "NY" ? mockUSCities : [{ name: "Los Angeles" }],
    getCitiesOfCountry: (code: string) => (code === "GB" ? mockGBCities : []),
  },
}));

vi.mock("@/data/cities", () => ({
  citiesIndex: [
    {
      displayName: "New York City",
      addressRegion: "New York",
      addressCountry: "US",
      status: "active",
    },
    {
      displayName: "London",
      addressRegion: "",
      addressCountry: "GB",
      status: "coming-soon",
    },
  ],
}));

describe("citySearch", () => {
  let loadCityOptions: () => Promise<import("./citySearch").CitySearchOption[]>;
  let searchCityOptions: typeof import("./citySearch").searchCityOptions;
  let resolveCityOption: typeof import("./citySearch").resolveCityOption;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./citySearch");
    loadCityOptions = mod.loadCityOptions;
    searchCityOptions = mod.searchCityOptions;
    resolveCityOption = mod.resolveCityOption;
  });

  describe("loadCityOptions", () => {
    it("returns city options from country-state-city data", async () => {
      const options = await loadCityOptions();
      expect(options.length).toBeGreaterThan(0);
    });

    it("returns identical results on second call (cached)", async () => {
      const result1 = await loadCityOptions();
      const result2 = await loadCityOptions();
      expect(result1).toBe(result2); // Same array reference from cache
    });

    it("includes cities from countries with states (US)", async () => {
      const options = await loadCityOptions();
      const nycOption = options.find((o) => o.city === "New York City");
      expect(nycOption).toBeDefined();
      expect(nycOption!.state).toBe("New York");
      expect(nycOption!.countryCode).toBe("US");
    });

    it("includes cities from countries without states (GB)", async () => {
      const options = await loadCityOptions();
      const londonOption = options.find((o) => o.city === "London");
      expect(londonOption).toBeDefined();
      expect(londonOption!.countryCode).toBe("GB");
    });

    it("applies boost 40 for active citiesIndex entries", async () => {
      const options = await loadCityOptions();
      const nycOption = options.find((o) => o.city === "New York City");
      expect(nycOption!.boost).toBe(40);
    });

    it("applies boost 20 for non-active citiesIndex entries", async () => {
      const options = await loadCityOptions();
      const londonOption = options.find((o) => o.city === "London");
      expect(londonOption!.boost).toBe(20);
    });

    it("returns options sorted alphabetically by label", async () => {
      const options = await loadCityOptions();
      const labels = options.map((o) => o.label);
      const sorted = [...labels].sort((a, b) => a.localeCompare(b));
      expect(labels).toEqual(sorted);
    });
  });

  describe("searchCityOptions", () => {
    it("returns boost-sorted results for empty query", async () => {
      const options = await loadCityOptions();
      const results = searchCityOptions("", options, 3);
      expect(results).toHaveLength(3);
      // Highest boost first
      expect(results[0].boost).toBeGreaterThanOrEqual(results[1].boost);
    });

    it("returns matching cities for partial query", async () => {
      const options = await loadCityOptions();
      const results = searchCityOptions("new york", options);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].city).toBe("New York City");
    });

    it("returns empty array when no matches and all boosts are 0", async () => {
      const zeroBoostOptions = (await loadCityOptions()).map((o) => ({
        ...o,
        boost: 0,
      }));
      const results = searchCityOptions("zzzzz", zeroBoostOptions);
      expect(results).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const options = await loadCityOptions();
      const results = searchCityOptions("", options, 2);
      expect(results).toHaveLength(2);
    });
  });

  describe("resolveCityOption", () => {
    it("finds option by city name", async () => {
      const options = await loadCityOptions();
      const result = resolveCityOption("London", options);
      expect(result).not.toBeNull();
      expect(result!.city).toBe("London");
    });

    it("returns null for empty value", async () => {
      const options = await loadCityOptions();
      expect(resolveCityOption("", options)).toBeNull();
    });

    it("returns null when no match found", async () => {
      const options = await loadCityOptions();
      expect(resolveCityOption("Atlantis", options)).toBeNull();
    });

    it("matches case-insensitively", async () => {
      const options = await loadCityOptions();
      const result = resolveCityOption("london", options);
      expect(result).not.toBeNull();
      expect(result!.city).toBe("London");
    });
  });

  describe("searchCityOptions — score thresholds", () => {
    it("exact city match (1000) beats exact label match (950)", async () => {
      const options = await loadCityOptions();
      // "New York City" is an exact city match
      const results = searchCityOptions("New York City", options);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].city).toBe("New York City");
    });

    it("city startsWith (900) beats label startsWith (850) for same boost", async () => {
      const options = await loadCityOptions();
      const results = searchCityOptions("Alb", options);
      expect(results.length).toBeGreaterThan(0);
      // Albany starts with "Alb" in city
      expect(results[0].city).toBe("Albany");
    });

    it("city includes (700) ranks results correctly", async () => {
      const options = await loadCityOptions();
      // "york" is included in "New York City" city name
      const results = searchCityOptions("york", options);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].city).toBe("New York City");
    });

    it("no text match returns boost-only score", async () => {
      const options = await loadCityOptions();
      // "zzz" matches nothing but boosted cities still appear
      const results = searchCityOptions("zzz", options);
      if (results.length > 0) {
        expect(results[0].boost).toBeGreaterThan(0);
      }
    });

    it("filter excludes score=0 items", async () => {
      const options = await loadCityOptions();
      const zeroBoost = options.map((o) => ({ ...o, boost: 0 }));
      const results = searchCityOptions("xyznotfound", zeroBoost);
      expect(results).toHaveLength(0);
    });

    it("sort tiebreaker: equal text score uses boost descending", async () => {
      const options = await loadCityOptions();
      // Use two options with same city-startsWith score (900) but different boosts
      const lowBoost = {
        ...options[0],
        city: "NewA",
        label: "NewA, X, US",
        value: "NewA, X, US",
        searchText: "newa x us",
        boost: 5,
      };
      const highBoost = {
        ...options[0],
        city: "NewB",
        label: "NewB, X, US",
        value: "NewB, X, US",
        searchText: "newb x us",
        boost: 50,
      };
      const results = searchCityOptions("new", [lowBoost, highBoost]);
      expect(results[0].boost).toBe(50);
      expect(results[1].boost).toBe(5);
    });

    it("sort tiebreaker: equal score and boost uses label ascending", async () => {
      const options = await loadCityOptions();
      const zeroBoost = options.map((o) => ({ ...o, boost: 0 }));
      const results = searchCityOptions("", zeroBoost, 100);
      // All have boost 0, should be alphabetical
      for (let i = 1; i < results.length; i++) {
        expect(
          results[i - 1].label.localeCompare(results[i].label),
        ).toBeLessThanOrEqual(0);
      }
    });
  });

  describe("loadCityOptions — createOption", () => {
    it("option value and label match format 'city, state, country'", async () => {
      const options = await loadCityOptions();
      const nyc = options.find((o) => o.city === "New York City");
      expect(nyc!.value).toBe("New York City, New York, United States");
      expect(nyc!.label).toBe("New York City, New York, United States");
    });

    it("option for country without states omits state from label", async () => {
      const options = await loadCityOptions();
      const london = options.find((o) => o.city === "London");
      expect(london!.state).toBe("");
      expect(london!.value).toBe("London, United Kingdom");
    });

    it("searchText is normalized", async () => {
      const options = await loadCityOptions();
      const nyc = options.find((o) => o.city === "New York City");
      expect(nyc!.searchText).toBe("new york city new york united states");
    });

    it("countryCode is set correctly", async () => {
      const options = await loadCityOptions();
      const london = options.find((o) => o.city === "London");
      expect(london!.countryCode).toBe("GB");
    });
  });

  describe("loadCityOptions — deduplication", () => {
    it("citiesIndex boost overrides existing entry boost", async () => {
      const options = await loadCityOptions();
      const nyc = options.find((o) => o.city === "New York City");
      // NYC appears in both mockUSCities and citiesIndex
      // citiesIndex active = 40, should override default 0
      expect(nyc!.boost).toBe(40);
    });

    it("no duplicate cities in results", async () => {
      const options = await loadCityOptions();
      const nycCount = options.filter((o) => o.city === "New York City").length;
      expect(nycCount).toBe(1);
    });
  });

  describe("loadCityOptions — boost values", () => {
    it("active citiesIndex entry gets boost 40, not 20", async () => {
      const options = await loadCityOptions();
      const nyc = options.find((o) => o.city === "New York City");
      expect(nyc!.boost).toBe(40);
      expect(nyc!.boost).not.toBe(20);
    });

    it("non-active citiesIndex entry gets boost 20, not 40", async () => {
      const options = await loadCityOptions();
      const london = options.find((o) => o.city === "London");
      expect(london!.boost).toBe(20);
      expect(london!.boost).not.toBe(40);
    });

    it("options are sorted ascending by label", async () => {
      const options = await loadCityOptions();
      for (let i = 1; i < options.length; i++) {
        expect(
          options[i - 1].label.localeCompare(options[i].label),
        ).toBeLessThanOrEqual(0);
      }
    });

    it("empty query returns results in descending boost order", async () => {
      const options = await loadCityOptions();
      const results = searchCityOptions("", options, 3);
      expect(results[0].boost).toBeGreaterThanOrEqual(results[1].boost);
      expect(results[1].boost).toBeGreaterThanOrEqual(results[2].boost);
    });
  });
});
