import { describe, it, expect } from "vitest";
import type { EventEntry, EventsSnapshot } from "@/data/eventsSnapshot";
import { EDITOR } from "@/data/adminShows";
import { formFromEntry, type ShowForm } from "./showForm";
import { checkShowForm } from "./showIssues";

// ── Fixtures (never production data) ─────────────────────────────────────

function fixtureShow(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Jan 9",
    city: "Chicago",
    state: "Illinois",
    stateAbbr: "IL",
    citySlug: "chicago",
    slug: "chicago-2099-01-09",
    description: "Garam Masala Dating comes to Chicago.",
    lineup: ["surbhi", "wyatt"],
    ticketSource: "our-eventbrite",
    url: "https://www.eventbrite.com/e/garam-masala-dating-chicago-tickets-123",
    isoDate: "2099-01-09",
    startTime: "19:00",
    endTime: "21:00",
    price: "25",
    eventbriteId: "123",
    timezone: "America/Chicago",
    updatedAt: "2026-11-11T20:00:00.000Z",
    ...overrides,
  };
}

const chicago = fixtureShow();
const nyc = fixtureShow({
  date: "Mar 20",
  city: "Manhattan",
  state: "New York",
  stateAbbr: "NY",
  citySlug: "manhattan",
  slug: "manhattan-2027-03-20",
  isoDate: "2027-03-20",
  timezone: "America/New_York",
});
const cities = [
  { slug: "chicago", name: "Chicago", region: "IL" },
  { slug: "manhattan", name: "Manhattan", region: "NY" },
];

/** Check `edit(form)` of the show at `index` in `draft`, against `live`. */
function check(
  draft: EventsSnapshot,
  live: EventsSnapshot,
  index: number,
  edit: (form: ShowForm) => ShowForm,
) {
  const base = draft.events[index];
  const initial = formFromEntry(base, draft.events);
  return checkShowForm({
    form: edit(initial),
    initial,
    base,
    index,
    snapshot: draft,
    live,
    cities,
    nowIso: "2026-11-11T21:00:00.000Z",
  });
}

describe("checkShowForm", () => {
  it("moves a show that was never published to a new date with a new link", () => {
    const draft = { events: [chicago], tbaCities: [] };
    const live = { events: [], tbaCities: [] };
    const { candidate, problems } = check(draft, live, 0, (f) => ({
      ...f,
      isoDate: "2099-01-10",
    }));
    expect(problems).toEqual([]);
    expect(candidate.events[0].slug).toBe("chicago-2099-01-10");
    expect(candidate.events[0].previousDate).toBeUndefined();
  });

  it("keeps a published show's link and asks why its date moved", () => {
    const draft = { events: [chicago], tbaCities: [] };
    const { candidate, problems } = check(draft, draft, 0, (f) => ({
      ...f,
      isoDate: "2099-01-10",
    }));
    expect(candidate.events[0].slug).toBe("chicago-2099-01-09");
    expect(candidate.events[0].previousDate).toBe("2099-01-09");
    expect(problems.map((p) => p.path)).toContain("events.0.note");
  });

  it("reports a five digit year on the date field instead of throwing", () => {
    const draft = { events: [chicago], tbaCities: [] };
    const run = () =>
      check(draft, draft, 0, (f) => ({ ...f, isoDate: "10000-01-09" }));
    expect(run).not.toThrow();
    expect(run().problems).toContainEqual({
      path: "events.0.isoDate",
      message: EDITOR.badDate,
    });
  });

  it("reports a five digit on sale year instead of throwing", () => {
    const draft = { events: [chicago], tbaCities: [] };
    const run = () =>
      check(draft, draft, 0, (f) => ({
        ...f,
        onSaleLocal: "10000-01-01T10:00",
      }));
    expect(run).not.toThrow();
    expect(run().problems).toContainEqual({
      path: "events.0.onSaleAt",
      message: EDITOR.badDate,
    });
  });

  it("rejects a show start time the clocks skip on spring forward night", () => {
    const draft = { events: [nyc], tbaCities: [] };
    const { problems } = check(draft, draft, 0, (f) => ({
      ...f,
      isoDate: "2027-03-14",
      startTime: "02:30",
      endTime: "04:00",
      note: "Moved to the Sunday",
    }));
    expect(problems).toContainEqual({
      path: "events.0.startTime",
      message: EDITOR.skippedTime,
    });
  });

  it("accepts a show start time in the hour that repeats at fall back", () => {
    const draft = { events: [nyc], tbaCities: [] };
    const { problems } = check(draft, draft, 0, (f) => ({
      ...f,
      isoDate: "2027-11-07",
      startTime: "01:30",
      endTime: "03:00",
      note: "Moved to the Sunday",
    }));
    expect(problems).toEqual([]);
  });

  it("rejects an on sale time the clocks skip on spring forward night", () => {
    const draft = { events: [nyc], tbaCities: [] };
    const { problems } = check(draft, draft, 0, (f) => ({
      ...f,
      onSaleLocal: "2027-03-14T02:30",
    }));
    expect(problems).toContainEqual({
      path: "events.0.onSaleAt",
      message: EDITOR.skippedTime,
    });
  });
});
