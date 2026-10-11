import { describe, it, expect } from "vitest";
import {
  ambiguousAliases,
  isGeoEcho,
  marketBySlug,
  marketForCitySlug,
  markets,
  nearestMarket,
  parsePlace,
  resolveMarket,
  stateRollup,
} from "./markets";

describe("markets.json integrity", () => {
  it("loads every market with a unique slug", () => {
    expect(markets.length).toBeGreaterThan(20);
    expect(marketBySlug.size).toBe(markets.length);
  });

  it("gives every market at least one alias and one coordinate pair", () => {
    for (const market of markets) {
      const aliasCount = Object.values(market.aliases).reduce(
        (n, a) => n + a.length,
        0,
      );
      expect(aliasCount, `${market.slug} has no aliases`).toBeGreaterThan(0);
      expect(Number.isFinite(market.lat) && Number.isFinite(market.lon)).toBe(
        true,
      );
    }
  });

  it("points every stateRollup entry at a real market", () => {
    for (const slug of Object.values(stateRollup)) {
      expect(marketBySlug.has(slug)).toBe(true);
    }
  });

  it("leaves the multi-market states out of stateRollup", () => {
    // WHY pinned: a bare "CA" or "NY" cannot name one audience, and adding one
    // would silently route every unmatched Californian into a single bucket.
    for (const state of ["NY", "NJ", "CA", "TX", "FL", "PA", "VA"]) {
      expect(stateRollup[state], `${state} must not roll up`).toBeUndefined();
    }
  });

  it("keeps every market's own slug resolvable through its citySlugs or aliases", () => {
    for (const market of markets) {
      const viaSlug = marketForCitySlug(market.slug);
      const viaAlias = resolveMarket({ city: market.displayName }).market;
      expect(
        viaSlug === market.slug || viaAlias === market.slug,
        `${market.slug} is not reachable by its own slug or display name`,
      ).toBe(true);
    }
  });

  it("pins the exact set of aliases two markets both claim", () => {
    // WHY an exact list rather than "expect none": these collisions are real
    // places (Arlington VA and TX, Newark NJ and CA and DE) and cannot be
    // edited away. Pinning the set means adding a city that collides with an
    // existing one fails here instead of becoming a coin flip at send time.
    expect(ambiguousAliases()).toEqual([
      "arlington",
      "aurora",
      "concord",
      "dublin",
      "glendale",
      "hollywood",
      "newark",
      "norwalk",
      "plymouth",
      "richmond",
      "smyrna",
      "somerville",
      "union city",
      "woodbridge",
    ]);
  });

  it("refuses an ambiguous city with no state instead of guessing", () => {
    for (const alias of ambiguousAliases()) {
      const result = resolveMarket({ city: alias });
      expect(result.market, `${alias} resolved without a state`).toBeNull();
      expect(result.reason).toMatch(/ambiguous/);
    }
  });

  it("resolves an ambiguous city once a state is supplied", () => {
    expect(resolveMarket({ city: "Arlington, VA" }).market).toBe(
      "washington-dc",
    );
    expect(resolveMarket({ city: "Arlington, TX" }).market).toBe("dallas");
    expect(resolveMarket({ city: "Newark, NJ" }).market).toBe("north-jersey");
    expect(resolveMarket({ city: "Newark, CA" }).market).toBe("san-francisco");
  });
});

describe("parsePlace", () => {
  it("splits the location shapes the lead data actually contains", () => {
    expect(parsePlace("Edison, NJ")).toEqual({ name: "edison", state: "NJ" });
    expect(parsePlace("los angeles, ca")).toEqual({
      name: "los angeles",
      state: "CA",
    });
    expect(parsePlace("Chicago, Illinois")).toEqual({
      name: "chicago",
      state: "IL",
    });
    expect(parsePlace("San Francisco")).toEqual({
      name: "san francisco",
      state: null,
    });
    expect(parsePlace("washington dc / nova")).toEqual({
      name: "washington dc",
      state: null,
    });
    expect(parsePlace("Manhattan NY")).toEqual({
      name: "manhattan",
      state: "NY",
    });
  });

  it("decodes the URL-escaped values the geo prefill submits", () => {
    expect(parsePlace("Des%20Moines")).toEqual({
      name: "des moines",
      state: null,
    });
    expect(parsePlace("san%20jose")).toEqual({ name: "san jose", state: null });
  });

  it("survives a malformed percent escape instead of throwing", () => {
    expect(() => parsePlace("Chicago%")).not.toThrow();
    expect(parsePlace("Chicago%").name).toContain("chicago");
  });

  it("keeps washington dc intact rather than stripping its own name", () => {
    // "washington" alone is a state and a city, so the DC token must survive.
    expect(resolveMarket({ city: "Washington DC" }).market).toBe(
      "washington-dc",
    );
    expect(resolveMarket({ city: "washington, dc" }).market).toBe(
      "washington-dc",
    );
  });
});

describe("isGeoEcho", () => {
  it("flags a URL-encoded city with no comparison needed", () => {
    expect(isGeoEcho("Des%20Moines", null)).toBe(true);
    expect(isGeoEcho("San%20Jose", "")).toBe(true);
  });

  it("flags a city identical to geoCity", () => {
    expect(isGeoEcho("Chicago", "Chicago")).toBe(true);
    expect(isGeoEcho("boydton", "Boydton")).toBe(true);
  });

  it("does not flag a typed city carrying a state the prefill never writes", () => {
    expect(isGeoEcho("Los Angeles, CA", "Los Angeles")).toBe(false);
    expect(isGeoEcho("Chicago, IL", "Chicago")).toBe(false);
  });

  it("does not flag a city that disagrees with geoCity", () => {
    expect(isGeoEcho("Edison", "Newark")).toBe(false);
    expect(isGeoEcho("Edison", null)).toBe(false);
  });

  it("is false when there is no city at all", () => {
    expect(isGeoEcho(null, "Chicago")).toBe(false);
    expect(isGeoEcho("", "Chicago")).toBe(false);
  });
});

describe("resolveMarket precedence", () => {
  it("prefers a typed city over the page they were browsing", () => {
    expect(
      resolveMarket({ city: "San Diego, CA", sourceCitySlug: "los-angeles" }),
    ).toEqual({
      market: "san-diego",
      confidence: "high",
      source: "self-reported",
    });
  });

  it("uses sourceCitySlug when the typed city is a geo echo", () => {
    expect(
      resolveMarket({
        city: "Des%20Moines",
        geoCity: "Des%20Moines",
        sourceCitySlug: "chicago",
      }),
    ).toEqual({ market: "chicago", confidence: "high", source: "source-city" });
  });

  it("grades a datacenter echo low rather than high", () => {
    const result = resolveMarket({
      city: "Des%20Moines",
      geoCity: "Des%20Moines",
    });
    // Des Moines is not a market, so this one has nowhere to go at all.
    expect(result.market).toBeNull();

    const chicago = resolveMarket({ city: "Chicago", geoCity: "Chicago" });
    expect(chicago).toEqual({
      market: "chicago",
      confidence: "low",
      source: "geo",
    });
  });

  it("falls back to coordinates and grades them low", () => {
    expect(
      resolveMarket({ geoLatitude: "40.7128", geoLongitude: "-74.0060" }),
    ).toEqual({
      market: "new-york",
      confidence: "low",
      source: "geo",
    });
    expect(
      resolveMarket({ geoLatitude: 37.3382, geoLongitude: -121.8863 }),
    ).toEqual({
      market: "san-francisco",
      confidence: "low",
      source: "geo",
    });
  });

  it("maps an events.ts citySlug onto its market", () => {
    expect(marketForCitySlug("manhattan")).toBe("new-york");
    expect(marketForCitySlug("edison")).toBe("north-jersey");
    expect(marketForCitySlug("jersey-city")).toBe("north-jersey");
    expect(marketForCitySlug("washington-dc")).toBe("washington-dc");
    expect(marketForCitySlug("san-diego")).toBe("san-diego");
    expect(marketForCitySlug("pune")).toBeNull();
  });

  it("covers every citySlug the live events file targets", () => {
    // These are the citySlug values in src/data/events.ts as of 2026-10-02. A
    // show whose city has no market cannot be announced to anyone.
    for (const slug of [
      "manhattan",
      "san-diego",
      "chicago",
      "jersey-city",
      "san-francisco",
      "edison",
      "los-angeles",
      "boston",
      "philadelphia",
      "washington-dc",
    ]) {
      expect(marketForCitySlug(slug), `${slug} has no market`).not.toBeNull();
    }
  });

  it("rolls an unknown city up by state only where the state holds one market", () => {
    expect(resolveMarket({ city: "Chandler Heights, AZ" })).toEqual({
      market: "phoenix",
      confidence: "medium",
      source: "self-reported",
    });
    expect(resolveMarket({ city: "Bakersfield, CA" }).market).toBeNull();
  });

  it("returns a reason naming the obstacle when nothing resolves", () => {
    expect(resolveMarket({}).reason).toMatch(
      /no city, source city or coordinates/,
    );
    expect(resolveMarket({ city: "London" }).reason).toMatch(
      /not in any market/,
    );
    expect(
      resolveMarket({ geoLatitude: 19.076, geoLongitude: 72.8777 }).reason,
    ).toMatch(/outside every market radius/);
  });

  it("keeps international leads out of every market", () => {
    for (const city of [
      "London",
      "Mumbai",
      "Pune",
      "Bengaluru",
      "Chennai",
      "Toronto",
    ]) {
      expect(
        resolveMarket({ city }).market,
        `${city} must not bucket`,
      ).toBeNull();
    }
  });

  it("never emits a confidence or source the Firestore rule would reject", () => {
    const inputs = [
      { city: "Edison, NJ" },
      { city: "Chandler Heights, AZ" },
      { city: "Chicago", geoCity: "Chicago" },
      { sourceCitySlug: "los-angeles" },
      { geoLatitude: 41.8781, geoLongitude: -87.6298 },
      {},
    ];
    for (const input of inputs) {
      const { confidence, source } = resolveMarket(input);
      expect(
        confidence === null || ["high", "medium", "low"].includes(confidence),
      ).toBe(true);
      expect(
        source === null ||
          ["self-reported", "source-city", "geo"].includes(source),
      ).toBe(true);
    }
  });
});

describe("nearestMarket", () => {
  it("returns null outside every radius", () => {
    expect(nearestMarket(64.1466, -21.9426)).toBeNull(); // Reykjavik
    expect(nearestMarket(19.076, 72.8777)).toBeNull(); // Mumbai
  });

  it("picks the closer of two overlapping metros", () => {
    // Jersey City sits inside both the New York and North Jersey radii.
    expect(nearestMarket(40.7178, -74.0431)?.slug).toBe("new-york");
    // Edison is far enough west that North Jersey wins.
    expect(nearestMarket(40.5187, -74.4121)?.slug).toBe("north-jersey");
  });
});
