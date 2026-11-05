import { isDisplayable } from "@/data/events";
import type { EventEntry } from "@/data/events";

export function isDatedUpcoming(e: EventEntry, todayISO: string): boolean {
  return isDisplayable(e) && !!e.isoDate && e.isoDate >= todayISO;
}

export function getUpcomingDated(
  events: EventEntry[],
  todayISO: string,
): EventEntry[] {
  return events
    .filter((e) => isDatedUpcoming(e, todayISO))
    .sort((a, b) => a.isoDate!.localeCompare(b.isoDate!));
}

/**
 * Input list for per-event JSON-LD blocks: displayable dated shows on or
 * after today. Canceled shows are excluded on purpose: their cards are not
 * rendered, and structured data must describe user-visible page content.
 */
export function getSchemaDated(
  events: EventEntry[],
  todayISO: string,
): EventEntry[] {
  return events.filter(
    (e) => isDisplayable(e) && !!e.isoDate && e.isoDate >= todayISO,
  );
}

// These withdrawn Texas placeholders are not upcoming ticket-page shows.
// A newly announced Texas show has its own slug and remains eligible.
const withdrawnTicketSlugs = new Set([
  "austin-2026-11-19",
  "houston-2026-11-20",
  "san-antonio-2026-11-21",
  "dallas-2026-11-22",
]);

export function getTicketPageUpcoming(
  events: EventEntry[],
  todayISO: string,
): EventEntry[] {
  return getUpcomingDated(
    events.filter((event) => !withdrawnTicketSlugs.has(event.slug)),
    todayISO,
  );
}
