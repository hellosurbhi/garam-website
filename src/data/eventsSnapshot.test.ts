import { describe, it, expect } from "vitest";
import { validateSnapshotAgainstLive } from "./eventsSnapshot";

describe("validateSnapshotAgainstLive", () => {
  it("accepts a coming soon city whose region is a full name", () => {
    // Fixture only: the region string is the London city page's addressRegion.
    const next = {
      events: [],
      tbaCities: [
        {
          city: "London",
          state: "England",
          stateAbbr: "Greater London",
          citySlug: "london",
        },
      ],
    };
    const result = validateSnapshotAgainstLive(
      next,
      { events: [], tbaCities: [] },
      { knownCitySlugs: new Set(["london"]) },
    );
    expect(result.ok ? [] : result.issues).toEqual([]);
  });
});
