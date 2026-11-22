import { describe, it, expect } from "vitest";
// WHY the frozen migration baseline: the test names a specific committed record,
// and the live file moves forward with every publish.
import published from "../../../test/fixtures/events-migration-baseline.json" with { type: "json" };
import type { EventEntry } from "@/data/eventsSnapshot";
import {
  entryFromForm,
  formFromEntry,
  timezoneChoices,
  withCity,
  withTimezone,
  emptyForm,
} from "./showForm";
import { localToIso } from "@/utils/timezone";

// WHY the real published record: manhattan-2026-10-11 predates the timezone
// field, which is exactly the legacy shape the on-sale round trip broke on.
const events = published.snapshot.events as EventEntry[];
const manhattan = events.find((e) => e.slug === "manhattan-2026-10-11");

describe("entryFromForm", () => {
  it("keeps a legacy on-sale time exactly when only the zone and tagline change", () => {
    if (!manhattan) throw new Error("fixture show missing");
    expect(manhattan.timezone).toBeUndefined();
    const initial = formFromEntry(manhattan, events);
    // The editor's zone picker goes through withTimezone.
    const form = {
      ...withTimezone(initial, "America/New_York", manhattan),
      tagline: "All Stars, round two",
    };
    const entry = entryFromForm(
      form,
      manhattan,
      "2026-11-11T00:00:00.000Z",
      true,
    );
    expect(entry.onSaleAt).toBe(manhattan.onSaleAt);
    expect(entry.tagline).toBe("All Stars, round two");
  });

  it("converts an on-sale time the admin did change in the picked zone", () => {
    if (!manhattan) throw new Error("fixture show missing");
    const initial = formFromEntry(manhattan, events);
    const form = {
      ...initial,
      timezone: "America/New_York",
      onSaleLocal: "2026-08-21T10:00",
    };
    const entry = entryFromForm(
      form,
      manhattan,
      "2026-11-11T00:00:00.000Z",
      true,
    );
    expect(entry.onSaleAt).toBe("2026-08-21T14:00:00.000Z");
  });
});

describe("timezoneChoices", () => {
  it("offers time zones outside the Americas for touring shows", () => {
    const zones = timezoneChoices("");
    expect(zones).toContain("Europe/London");
    expect(zones).toContain("America/New_York");
  });
});

describe("localToIso", () => {
  it("reads 01:30 on fall back night in New York as the first, daylight 01:30", () => {
    expect(localToIso("2027-11-07T01:30", "America/New_York")).toBe(
      "2027-11-07T05:30:00.000Z",
    );
  });

  it("reads 01:30 on fall back night in London as the first, summer time 01:30", () => {
    expect(localToIso("2027-10-31T01:30", "Europe/London")).toBe(
      "2027-10-31T00:30:00.000Z",
    );
  });
});

describe("withCity", () => {
  const chicago = { slug: "chicago", name: "Chicago", region: "IL" };
  const tour = { slug: "boise", name: "Boise", region: "ID" };
  const snapshot = {
    events: [
      {
        ...(events[0] as EventEntry),
        citySlug: "chicago",
        stateAbbr: "IL",
        state: "Illinois",
        timezone: "America/Chicago",
      },
    ],
    tbaCities: [],
  };

  it("fills the state and zone from saved records for the city", () => {
    const form = withCity(emptyForm(), chicago, snapshot);
    expect(form.state).toBe("Illinois");
    expect(form.timezone).toBe("America/Chicago");
  });

  it("clears the previous city's state and zone when the new city has none", () => {
    const first = withCity(emptyForm(), chicago, snapshot);
    const next = withCity(first, tour, snapshot);
    expect(next.citySlug).toBe("boise");
    expect(next.stateAbbr).toBe("ID");
    expect(next.state).toBe("");
    expect(next.timezone).toBe("");
  });
});
