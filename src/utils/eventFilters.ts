import type { EventEntry } from "@/data/events";

export function isDatedUpcoming(e: EventEntry, todayISO: string): boolean {
  return !e.hidden && !!e.isoDate && e.isoDate >= todayISO;
}

export function getUpcomingDated(
  events: EventEntry[],
  todayISO: string,
): EventEntry[] {
  return events
    .filter((e) => isDatedUpcoming(e, todayISO))
    .sort((a, b) => a.isoDate!.localeCompare(b.isoDate!));
}
