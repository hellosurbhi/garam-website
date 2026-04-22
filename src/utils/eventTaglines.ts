import type { EventEntry } from "@/data/events";

const CYCLE_TAGLINES = ["On sale now", "Book early", "Grab your spot"];

export function getPositionalTagline(position: number): string {
  if (position === 0) return "Almost sold out";
  if (position === 1) return "Just announced";
  return CYCLE_TAGLINES[(position - 2) % CYCLE_TAGLINES.length];
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
