import { describe, it, expect } from "vitest";
import published from "@/data/events.published.json";
import type { EventEntry } from "@/data/eventsSnapshot";
import { entryFromForm, formFromEntry } from "./showForm";

// WHY the real published record: manhattan-2026-10-11 predates the timezone
// field, which is exactly the legacy shape the on-sale round trip broke on.
const events = published.snapshot.events as EventEntry[];
const manhattan = events.find((e) => e.slug === "manhattan-2026-10-11");

describe("entryFromForm", () => {
  it("keeps a legacy on-sale time exactly when only the zone and tagline change", () => {
    if (!manhattan) throw new Error("fixture show missing");
    expect(manhattan.timezone).toBeUndefined();
    const initial = formFromEntry(manhattan, events);
    const form = {
      ...initial,
      timezone: "America/New_York",
      tagline: "All Stars, round two",
    };
    const entry = entryFromForm(
      form,
      manhattan,
      "2026-11-11T00:00:00.000Z",
      initial,
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
      initial,
    );
    expect(entry.onSaleAt).toBe("2026-08-21T14:00:00.000Z");
  });
});
