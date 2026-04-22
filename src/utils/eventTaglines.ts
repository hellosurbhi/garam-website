import type { EventEntry } from "@/data/events";
import { EVENT_TAGLINES } from "@/data/copy";

export function getPositionalTagline(position: number): string {
  if (position === 0) return EVENT_TAGLINES.almostSoldOut;
  if (position === 1) return EVENT_TAGLINES.justAnnounced;
  return EVENT_TAGLINES.cycle[(position - 2) % EVENT_TAGLINES.cycle.length];
}

/** Builds a URL-keyed map of positional taglines for live, non-sold-out events. */
export function buildTaglineMap(events: EventEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  let position = 0;
  for (const event of events) {
    if (event.url && event.url !== "#" && !(event.soldOut ?? false)) {
      map.set(event.url, getPositionalTagline(position));
      position++;
    }
  }
  return map;
}
