import { describe, expect, it } from "vitest";
import { SHOWS_LIST } from "@/data/adminShows";
import type { EventEntry, EventsSnapshot } from "@/data/eventsSnapshot";
import { previewShows } from "./showsView";

function show(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Nov 20",
    city: "Chicago",
    state: "Illinois",
    stateAbbr: "IL",
    citySlug: "chicago",
    slug: "chicago-2026-11-20",
    description: "Garam Masala Dating comes to Chicago.",
    lineup: ["surbhi", "wyatt"],
    ticketSource: "none",
    url: "",
    isoDate: "2026-11-20",
    startTime: "19:00",
    endTime: "21:00",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("previewShows with a waitlist selection from an earlier day", () => {
  const snapshot: EventsSnapshot = { events: [show()], tbaCities: [] };
  // The server chose this show for a Notify Me card while it was upcoming.
  const waitlist = { datedSlugs: ["chicago-2026-11-20"], cities: [] };

  it("keeps the Notify Me label while the show is still today or later", () => {
    const out = previewShows(snapshot, "2026-11-20", waitlist);
    expect(out.get("chicago-2026-11-20")?.label).toBe(SHOWS_LIST.notifyCard);
  });

  it("calls the show past once the day has moved on, before any refetch", () => {
    const out = previewShows(snapshot, "2026-11-21", waitlist);
    expect(out.get("chicago-2026-11-20")).toEqual({
      label: SHOWS_LIST.past,
      tone: "off",
    });
  });
});
