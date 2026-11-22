/**
 * The list of pages the site builds from a published snapshot: confirmed
 * shows plus Coming soon cards. Lives in its own module so the build
 * (src/data/events.ts) and the admin's save and publish check
 * (src/data/eventsSnapshot.ts) run the very same code on the same list.
 *
 * WHY relative imports: astro.config.mjs reaches this through events.ts, and
 * the config loader cannot resolve the "@/" alias (see events.ts).
 */
import { DEFAULT_LINEUP } from "./lineup";
import { buildEventSlug } from "./eventSlug";
import type { EventEntry, EventsSnapshot, TbaCity } from "./eventsSnapshot";

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
