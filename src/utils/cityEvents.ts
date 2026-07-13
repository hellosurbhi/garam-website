import { events } from "@/data/events";
import type { EventEntry } from "@/data/events";

function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * An event is "upcoming" for a city when it is not hidden, has an ISO date on
 * or after `today`, a real ticket URL and a city slug. This is the single
 * gate behind the city page CTA state machine: once an event's isoDate falls
 * before today, it drops out here and the page reverts to the no-event state
 * automatically on the next build. `today` is injectable for tests.
 */
export function isUpcomingEvent(
  e: EventEntry,
  today: string = currentDay(),
): boolean {
  return (
    !e.hidden &&
    !!e.isoDate &&
    e.isoDate >= today &&
    e.url !== "#" &&
    e.url !== "" &&
    !!e.citySlug
  );
}

export function getUpcomingEventsForCity(citySlug: string): EventEntry[] {
  const today = currentDay();
  return events.filter(
    (e) => isUpcomingEvent(e, today) && e.citySlug === citySlug,
  );
}

/**
 * Unique slugs of cities with at least one upcoming event, ordered by each
 * city's soonest show date. Consumers render these as "tickets on sale"
 * lists, so the order must not depend on how events.ts happens to be
 * arranged. `today` and `eventList` are injectable for tests.
 */
export function citySlugsWithUpcomingEvents(
  today: string = currentDay(),
  eventList: EventEntry[] = events,
): string[] {
  const upcoming = eventList
    .filter((e) => isUpcomingEvent(e, today))
    .sort((a, b) => (a.isoDate ?? "").localeCompare(b.isoDate ?? ""));
  const slugs = new Set<string>();
  for (const e of upcoming) {
    if (e.citySlug) {
      slugs.add(e.citySlug);
    }
  }
  return [...slugs];
}
