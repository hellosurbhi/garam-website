import { events } from "@/data/events";
import type { EventEntry } from "@/data/events";

const today = new Date().toISOString().slice(0, 10);

function isUpcomingEvent(e: EventEntry): boolean {
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
