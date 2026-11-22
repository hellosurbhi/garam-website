import { describe, it, expect } from "vitest";
import fixture from "./fixtures/events-pre-migration.json";
import baseline from "./fixtures/events-migration-baseline.json";
import { buildAllEvents, tbaCityToEvent } from "../src/data/eventPages";
import type { EventsSnapshot } from "../src/data/eventsSnapshot";

// WHY the frozen baseline and not src/data/events: that module reads
// events.published.json, which `npm run events:pull` and every publish move
// forward. This oracle compares the MIGRATION's output with the pre-migration
// code, so it runs on the frozen version 1 snapshot and never changes.
const publishedSnapshot = baseline.snapshot as EventsSnapshot;
const events = publishedSnapshot.events;
const comingSoonEvents = publishedSnapshot.tbaCities.map(tbaCityToEvent);
const TBA_CITY_SLUGS = publishedSnapshot.tbaCities.map((c) => c.citySlug);

// WHY strip updatedAt: it is the one field the migration added to each
// record (plan R17); everything else must match the output of the OLD
// hand-written events.ts byte for byte, which this fixture captured before
// the refactor (scripts/export-events-baseline.ts, kept in git history).
function withoutUpdatedAt<T extends { updatedAt?: string }>(
  list: T[],
): Omit<T, "updatedAt">[] {
  return list.map((entry) => {
    const copy: Partial<T> = { ...entry };
    delete copy.updatedAt;
    return copy as Omit<T, "updatedAt">;
  });
}

describe("events.ts migration oracle (issue 337)", () => {
  it("keeps all 31 show records", () => {
    expect(events).toHaveLength(31);
  });

  it("serves the same show records as the pre-migration code", () => {
    expect(withoutUpdatedAt(events)).toEqual(fixture.events);
  });

  it("serves the same coming soon cities", () => {
    expect(publishedSnapshot.tbaCities).toEqual(fixture.TBA_CITIES);
    expect(TBA_CITY_SLUGS).toEqual(fixture.TBA_CITIES.map((c) => c.citySlug));
    expect(comingSoonEvents.map((e) => e.citySlug)).toEqual(TBA_CITY_SLUGS);
  });

  it("builds the same show pages for a fixed day", () => {
    expect(
      withoutUpdatedAt(buildAllEvents(publishedSnapshot, fixture.todayIso)),
    ).toEqual(fixture.allEvents);
  });
});
