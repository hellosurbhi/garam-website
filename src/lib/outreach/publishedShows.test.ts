import { it, expect } from "vitest";
import { mergeShows } from "./publishedShows";
import { defaultTemplates } from "@/data/outreach";
import type { Show } from "./model";
const show: Show = {
  id: "new-show",
  city: "Chicago",
  date: "2026-10-24",
  time: "18:00",
  timezone: "America/Chicago",
  venue: "The Lincoln Lodge",
  tickets: "https://example.org/tickets",
  audience: "all",
  enabled: false,
  published: true,
  templates: defaultTemplates,
  createdAt: 0,
  updatedAt: 0,
};
it("publishes the same date, venue and ticket link used by email", () => {
  const [event] = mergeShows([show], []);
  expect(event).toMatchObject({
    slug: show.id,
    isoDate: show.date,
    url: show.tickets,
    venue: { name: show.venue },
  });
});
it("pausing emails does not remove a published show", () => {
  expect(mergeShows([show], [])).toHaveLength(1);
});
it("unpublishing removes an existing catalog entry with the same id", () => {
  expect(
    mergeShows([{ ...show, published: false }], mergeShows([show], [])),
  ).toEqual([]);
});
it("replaces instead of duplicating a managed catalog show", () => {
  const result = mergeShows(
    [{ ...show, venue: "New venue" }],
    mergeShows([show], []),
  );
  expect(result).toHaveLength(1);
  expect(result[0].venue?.name).toBe("New venue");
});
