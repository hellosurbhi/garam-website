import type { EventEntry } from "../data/events";

type EventRedirect = { destination: string; status: 308 };

/**
 * Every date a show has been listed under: its current isoDate plus all
 * former dates. Each one is a public link (`${citySlug}-${date}`) that must
 * keep resolving, so the redirect builder and the publish validator
 * (src/data/eventsSnapshot.ts) both derive aliases from this one list.
 */
export function eventAliasDates(
  event: Pick<EventEntry, "isoDate" | "previousDate" | "previousDates">,
): string[] {
  const dates = new Set([
    event.isoDate,
    event.previousDate,
    ...(event.previousDates ?? []),
  ]);
  return [...dates].filter((date): date is string => Boolean(date));
}

/** Generate direct redirects without renaming a show's permanent slug. */
export function buildEventRedirects(
  events: readonly EventEntry[],
): Record<string, EventRedirect> {
  const owners = new Map<string, EventEntry>();
  for (const event of events) {
    if (owners.has(event.slug)) {
      throw new Error(`Duplicate event slug: ${event.slug}`);
    }
    owners.set(event.slug, event);
  }

  const redirects: Record<string, EventRedirect> = {};
  for (const event of events) {
    if (!event.citySlug) continue;
    for (const date of eventAliasDates(event)) {
      const alias = `${event.citySlug}-${date}`;
      if (alias === event.slug) continue;
      const owner = owners.get(alias);
      if (owner && owner !== event) {
        throw new Error(`Event alias ${alias} conflicts with ${owner.slug}`);
      }
      owners.set(alias, event);
      for (const prefix of ["/events/", "/api/go/"]) {
        redirects[`${prefix}${alias}`] = {
          destination: `${prefix}${event.slug}`,
          status: 308,
        };
      }
    }
  }
  return redirects;
}

/** Match redirect aliases independently of sitemap trailing-slash formatting. */
export function isEventRedirectUrl(
  page: string,
  redirects: Record<string, unknown>,
): boolean {
  return Object.hasOwn(redirects, new URL(page).pathname.replace(/\/+$/, ""));
}
