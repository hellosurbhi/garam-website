// WHY: this module has no runtime imports at all (the type import below is
// erased). It is shared by src/data/events.ts and src/data/eventsSnapshot.ts,
// which astro.config.mjs loads through Vite's config module runner without
// the "@/" alias, and by src/utils/eventSchema.ts, which uses that alias.
// Keeping the predicates here, dependency free, lets every one of them
// import the same function instead of keeping copies that can drift.
import type { EventEntry } from "./eventsSnapshot";

/**
 * True when an event may appear anywhere on the public site.
 * Canceled shows are permanent records (see EVENTS-HISTORY.md), never
 * deleted from this file; this predicate is what keeps them off every
 * surface. All upcoming/visible filters must go through it.
 */
export function isDisplayable(
  e: Pick<EventEntry, "hidden" | "status">,
): boolean {
  return !e.hidden && e.status !== "canceled";
}

/**
 * True when an event gets an Event JSON-LD block (src/utils/eventSchema.ts).
 * Such an event must also carry price, startTime and endTime, or the build
 * throws; the publish validator calls this same predicate so a publish can
 * never produce a snapshot that breaks the build.
 */
export function isSchemaEligible(
  e: Pick<EventEntry, "hidden" | "status" | "isoDate" | "venue" | "url">,
): boolean {
  return Boolean(
    isDisplayable(e) && e.isoDate && e.venue && e.url && e.url !== "#",
  );
}
