// WHY: relative imports only, because astro.config.mjs imports this file
// directly (same alias constraint as events.ts).
import { events, comingSoonEvents, isDisplayable } from "./events";
import type { EventEntry } from "./events";
import { isBuyableNow, isShowOver, sortUpcoming } from "./eventAvailability";

/**
 * Every event slug that has ever existed, including TBA cards that
 * computeAllEvents suppressed because their city now has a dated show.
 * getEventBySlug() only searches allEvents, so those suppressed slugs would
 * 404 for anyone holding an old link to them.
 */
export function getAnyEventBySlug(slug: string): EventEntry | undefined {
  return (
    events.find((e) => e.slug === slug) ??
    comingSoonEvents.find((e) => e.slug === slug)
  );
}

/**
 * True when a show's page should send people elsewhere instead of rendering:
 * canceled, over, or a coming-soon card whose city has since announced a date.
 */
export function needsRedirect(
  e: EventEntry,
  nowMs: number,
  list: EventEntry[] = [...events, ...comingSoonEvents],
): boolean {
  if (e.status === "canceled" || isShowOver(e, nowMs)) return true;
  if (e.isoDate || !e.citySlug) return false;
  return list.some(
    (o) =>
      o !== e &&
      o.citySlug === e.citySlug &&
      isDisplayable(o) &&
      !!o.isoDate &&
      !isShowOver(o, nowMs),
  );
}

/**
 * Where to send someone holding a link to `event`: the next show they can buy
 * in the same city, else that city's page (which carries the waitlist), else
 * /tickets. Never returns the event's own page.
 */
export function resolveEventRedirect(
  event: EventEntry,
  nowMs: number,
  list: EventEntry[] = [...events, ...comingSoonEvents],
): string {
  if (event.citySlug) {
    const next = sortUpcoming(
      list.filter(
        (o) =>
          o !== event &&
          o.citySlug === event.citySlug &&
          isBuyableNow(o, nowMs),
      ),
      nowMs,
    )[0];
    if (next) return `/events/${next.slug}`;
    return `/cities/${event.citySlug}`;
  }
  return "/tickets";
}

/**
 * One timestamp per build, shared by astro.config.mjs (redirect map) and
 * /events/[slug].astro (getStaticPaths).
 * WHY: each called Date.now() separately; a build crossing a show's end time
 * could skip the redirect (still running) and then skip the page (now over),
 * leaving the URL a 404. The config runs first in the same process, so the
 * first caller pins the value in process.env and every later caller reuses it.
 */
export function getBuildNowMs(): number {
  process.env.EVENT_BUILD_NOW_MS ??= String(Date.now());
  return Number(process.env.EVENT_BUILD_NOW_MS);
}

/** slug -> destination for every event page that must redirect (astro.config.mjs). */
export function buildEventRedirectMap(
  nowMs: number,
  list: EventEntry[] = [...events, ...comingSoonEvents],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of list) {
    if (needsRedirect(e, nowMs, list)) {
      map[`/events/${e.slug}`] = resolveEventRedirect(e, nowMs, list);
    }
  }
  return map;
}
