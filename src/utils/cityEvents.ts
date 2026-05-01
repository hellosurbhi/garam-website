import { events } from "@/data/events";
import type { EventEntry } from "@/data/events";
import { isEventPast } from "@/utils/eventDate";

function isUpcomingEvent(e: EventEntry): boolean {
  return (
    !e.hidden &&
    !isEventPast(e.date) &&
    e.url !== "#" &&
    e.url !== "" &&
    !!e.citySlug
  );
}

export function getUpcomingEventsForCity(citySlug: string): EventEntry[] {
  return events.filter((e) => isUpcomingEvent(e) && e.citySlug === citySlug);
}

export function citySlugsWithUpcomingEvents(): string[] {
  const slugs = new Set<string>();
  for (const e of events) {
    if (isUpcomingEvent(e) && e.citySlug) {
      slugs.add(e.citySlug);
    }
  }
  return [...slugs];
}
