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

/** A checkout must be open now, not sold out or awaiting its on-sale time. */
export function hasPurchasableTickets(
  event: EventEntry,
  now = new Date(),
): boolean {
  return (
    isDisplayable(event) &&
    Boolean(event.url && event.url !== "#") &&
    !event.soldOut &&
    (!event.onSaleAt || Date.parse(event.onSaleAt) <= now.getTime())
  );
}

/** Ticketed shows render immediately; ranked waitlists render in the shared island. */
export function getTicketPageUpcoming(
  events: EventEntry[],
  todayISO: string,
  now = new Date(),
): EventEntry[] {
  return getUpcomingDated(events, todayISO).filter((event) =>
    hasPurchasableTickets(event, now),
  );
}

/** Keep static ticket cards and deferred waitlists on the same page inventory. */
export function getListingInventory(
  events: EventEntry[],
  page: "home" | "tickets",
): EventEntry[] {
  return page === "home"
    ? events.filter(
        (event) => !["Salt Lake City", "Denver"].includes(event.city),
      )
    : events;
}
