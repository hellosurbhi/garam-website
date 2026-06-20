import type { EventEntry } from "@/data/events";

export function formatEventLocation(
  event: Pick<EventEntry, "city" | "stateAbbr">,
): string {
  return `${event.city}, ${event.stateAbbr}`;
}
