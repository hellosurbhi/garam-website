import type { EventEntry } from "@/data/events";

export function formatEventLocation(
  event: Pick<EventEntry, "city" | "state">,
): string {
  return `${event.city}, ${event.state}`;
}
