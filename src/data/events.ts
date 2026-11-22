// WHY: relative imports, not the "@/" alias, because this file is imported
// directly by astro.config.mjs (for sitemap generation) via a relative path.
// Astro/Vite's config-loading module runner does not apply the vite.resolve.alias
// defined inside that same config file when resolving the config's own transitive
// dependency graph, so an "@/" import here fails with "Cannot find module" during
// `astro build`/`astro check`. cities/index.ts and journal/index.ts (also imported
// directly by astro.config.mjs) follow the same relative-import convention for the
// same reason. If this file stops being imported directly by astro.config.mjs,
// this restriction no longer applies. test/events-config-safe.test.ts locks it in.
//
// The show records themselves live in events.published.json (issue 337): the
// admin Shows tab publishes new versions of that snapshot, and the build
// validates it with the schemas in ./eventsSnapshot (see below). Never delete a record
// from it (src/data/CLAUDE.md); cancel or hide instead.
import publishedJson from "./events.published.json" with { type: "json" };
import { buildAllEvents, computeAllEvents, tbaCityToEvent } from "./eventPages";
import type {
  EventEntry,
  EventsSnapshot,
  PublishedEnvelope,
  TbaCity,
} from "./eventsSnapshot";

export type {
  EventEntry,
  EventVenue,
  EventsSnapshot,
  TbaCity,
  TicketSource,
} from "./eventsSnapshot";
export { isDisplayable } from "./eventPredicates";
export { buildAllEvents, computeAllEvents, tbaCityToEvent };

const TODAY_ISO = new Date().toISOString().slice(0, 10);

// WHY a type assertion instead of publishedEnvelopeSchema.parse here: this
// module is bundled into client islands (the apply success panel and the
// admin casting pickers). Parsing here shipped zod and every snapshot schema
// to the public apply page (a 117 KB events chunk). The snapshot is validated
// before it can reach a build instead: astro.config.mjs parses it on every
// build and fails it loudly, and test/eventsSnapshot.test.ts parses the
// committed file in CI. Removing the astro.config.mjs parse makes this
// assertion unchecked.
const published = publishedJson as PublishedEnvelope;

/** The published snapshot this build renders. */
export const publishedSnapshot: EventsSnapshot = published.snapshot;

/** Every show ever scheduled, including hidden and canceled records. */
export const events: EventEntry[] = publishedSnapshot.events;

// Legacy expansion inventory also supplies the footer city roster.
// Homepage and tickets Notify Me cards use the ranked five-market selection.
// Edited from the admin Shows tab.
const TBA_CITIES: TbaCity[] = publishedSnapshot.tbaCities;

export const TBA_CITY_SLUGS: string[] = TBA_CITIES.map((c) => c.citySlug);

export const comingSoonEvents: EventEntry[] = TBA_CITIES.map(tbaCityToEvent);

/** All events: confirmed shows + TBA cities (suppressed when city has an upcoming confirmed show) */
export const allEvents: EventEntry[] = buildAllEvents(
  publishedSnapshot,
  TODAY_ISO,
);

/**
 * Sitemap lastmod (YYYY-MM-DD) per show page slug: the entry's own
 * `updatedAt`, which the Shows tab sets on every edit, else the snapshot's
 * `publishedAt` (TBA cards and records never edited since the migration).
 * Pass `allEvents`, not `events`: every slug that gets a page needs a date.
 */
export function eventLastmodDates(
  list: EventEntry[],
  publishedAt: string,
): Record<string, string> {
  return Object.fromEntries(
    list.map((e) => [e.slug, (e.updatedAt ?? publishedAt).slice(0, 10)]),
  );
}

/**
 * Returns the canonical display status for an event.
 * Prefers the machine-readable soldOut flag over the tagline so that
 * sold-out shows with no tagline are still surfaced correctly.
 */
export function getEventDisplayStatus(event: EventEntry): string | undefined {
  if (event.soldOut) return "Sold out";
  return event.tagline;
}

/**
 * Look up a single event by its /events/[slug] landing-page slug.
 *
 * Searches `allEvents` (confirmed shows + TBA cities) rather than `events`
 * alone, since every event with a landing page (including "coming soon"
 * cities) must resolve here. Callers that redirect to a real checkout
 * (src/pages/api/go/[slug].ts) must separately verify `event.url` is a
 * usable destination: TBA/coming-soon entries deliberately carry `url: ""`.
 *
 * `list` defaults to this build's list; runtime routes pass the live
 * published list from src/lib/publishedEvents.server.ts instead.
 */
export function getEventBySlug(
  slug: string,
  list: EventEntry[] = allEvents,
): EventEntry | undefined {
  return list.find((e) => e.slug === slug);
}
