import { allEvents, getEventBySlug, type EventEntry } from "@/data/events";
import { DEFAULT_LINEUP } from "@/data/lineup";
import { store } from "./store";
import { type Show } from "./model";
export function mergeShows(
  managed: Show[],
  existing: EventEntry[] = allEvents,
): EventEntry[] {
  const byId = new Map(existing.map((event) => [event.slug, event]));
  for (const show of managed) {
    const previous = byId.get(show.id);
    const citySeed = existing.find(
      (event) => event.city.toLowerCase() === show.city.toLowerCase(),
    );
    if (!show.published) {
      byId.delete(show.id);
      continue;
    }
    byId.set(show.id, {
      ...previous,
      slug: show.id,
      city: show.city,
      state: citySeed?.state ?? "",
      stateAbbr: citySeed?.stateAbbr ?? "",
      citySlug: citySeed?.citySlug,
      date: new Date(`${show.date}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
      isoDate: show.date,
      startTime: show.time,
      endTime: previous?.startTime === show.time ? previous.endTime : undefined,
      timezone: show.timezone,
      // A changed ticket link is never assumed to belong to our Eventbrite account.
      ticketSource:
        previous?.url === show.tickets
          ? previous.ticketSource
          : "other-platform",
      url: show.tickets,
      lineup: previous?.lineup ?? DEFAULT_LINEUP,
      description:
        previous?.description ??
        `Garam Masala Dating at ${show.venue} in ${show.city}.`,
      venue: {
        ...(previous?.venue?.name === show.venue
          ? previous.venue
          : {
              addressLocality: show.city,
              addressRegion: citySeed?.stateAbbr ?? "",
              addressCountry: "US",
            }),
        name: show.venue,
      },
    });
  }
  return [...byId.values()].sort((a, b) =>
    (a.isoDate ?? "9999").localeCompare(b.isoDate ?? "9999"),
  );
}
export async function publishedShows(): Promise<EventEntry[]> {
  if (import.meta.env.OUTREACH_ONLINE !== "1") return allEvents;
  return mergeShows((await store.list<Show>("emailShows")).map((s) => s.value));
}

export async function publishedShowBySlug(
  slug: string,
): Promise<EventEntry | undefined> {
  if (import.meta.env.OUTREACH_ONLINE !== "1") return getEventBySlug(slug);
  return (await publishedShows()).find((event) => event.slug === slug);
}
