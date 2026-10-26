import { isDisplayable } from "@/data/events";
import type { EventEntry } from "@/data/events";
import { isUpcoming, isShowOver, sortUpcoming } from "@/data/eventAvailability";

/** Start of the given UTC day; lets callers that only hold a date string stay deterministic. */
function nowFromToday(todayISO: string, nowMs?: number): number {
  return nowMs ?? Date.parse(`${todayISO}T00:00:00Z`);
}

export function isDatedUpcoming(
  e: EventEntry,
  todayISO: string,
  nowMs?: number,
): boolean {
  return (
    isDisplayable(e) &&
    !!e.isoDate &&
    !isShowOver(e, nowFromToday(todayISO, nowMs))
  );
}

/**
 * Dated upcoming shows in display order: buyable now first, then sold out or
 * presale, then "tickets coming soon" (placeholder dates). See
 * sortUpcoming() for why date order alone is wrong.
 */
export function getUpcomingDated(
  events: EventEntry[],
  todayISO: string,
  nowMs?: number,
): EventEntry[] {
  const now = nowFromToday(todayISO, nowMs);
  return sortUpcoming(
    events.filter((e) => isDatedUpcoming(e, todayISO, now)),
    now,
  );
}

/** Every upcoming card (dated and TBA) in display order: buyable first, coming soon last. */
export function getUpcomingOrdered(
  events: EventEntry[],
  todayISO: string,
  nowMs?: number,
): EventEntry[] {
  const now = nowFromToday(todayISO, nowMs);
  return sortUpcoming(
    events.filter((e) => isUpcoming(e, now)),
    now,
  );
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
