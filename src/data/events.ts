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
import { DEFAULT_LINEUP } from "./lineup";
import publishedJson from "./events.published.json";
import { buildEventSlug } from "./eventSlug";
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

// Only show TBA entries for cities with active tour planning (not all 200+
// expansion pages). These slugs appear as notify-me TBA cards on the tickets
// page and home shows section. Standing roster per owner instruction
// 2026-08-14: LA, SF and New York, always. Chicago and Houston removed the
// same day (see EVENTS-HISTORY.md). Edited from the admin Shows tab.
const TBA_CITIES: TbaCity[] = publishedSnapshot.tbaCities;

export const TBA_CITY_SLUGS: string[] = TBA_CITIES.map((c) => c.citySlug);

/** The notify-me card for a city with no announced date. */
export function tbaCityToEvent(city: TbaCity): EventEntry {
  return {
    date: "TBA",
    city: city.city,
    state: city.state,
    stateAbbr: city.stateAbbr,
    citySlug: city.citySlug,
    slug: buildEventSlug(city.citySlug),
    description: `Garam Masala Dating hasn't announced a date in ${city.city} yet. Join the list to be first to know when tickets drop.`,
    lineup: DEFAULT_LINEUP,
    ticketSource: "none",
    url: "",
    tagline: "Coming soon",
  };
}

export const comingSoonEvents: EventEntry[] = TBA_CITIES.map(tbaCityToEvent);

/**
 * Confirmed shows + TBA notify-me cards. A city's TBA card is suppressed
 * while that city has an upcoming displayable show; a canceled show must
 * NOT suppress it (the canceled Manhattan date is exactly when the New
 * York notify card needs to reappear). Pure and exported for tests.
 */
export function computeAllEvents(
  eventList: EventEntry[],
  tbaList: EventEntry[],
  todayISO: string,
): EventEntry[] {
  return [
    ...eventList,
    ...tbaList.filter(
      (tba) =>
        !eventList.some(
          (e) =>
            e.citySlug === tba.citySlug &&
            e.status !== "canceled" &&
            e.isoDate &&
            e.isoDate >= todayISO,
        ),
    ),
  ];
}

/**
 * Every show page for a snapshot: confirmed shows plus TBA cities. Shared
 * by this build and the admin preview so both compute it identically.
 */
export function buildAllEvents(
  snapshot: EventsSnapshot,
  todayIso: string,
): EventEntry[] {
  return computeAllEvents(
    snapshot.events,
    snapshot.tbaCities.map(tbaCityToEvent),
    todayIso,
  );
}

/** All events: confirmed shows + TBA cities (suppressed when city has an upcoming confirmed show) */
export const allEvents: EventEntry[] = buildAllEvents(
  publishedSnapshot,
  TODAY_ISO,
);

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
 */
export function getEventBySlug(slug: string): EventEntry | undefined {
  return allEvents.find((e) => e.slug === slug);
}
