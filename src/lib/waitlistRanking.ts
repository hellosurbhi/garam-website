import { isSyntheticSubmission } from "@/lib/syntheticMonitor";
import { SMOKE_TEST_EMAIL } from "./smokeTestIdentity";
import { cities } from "@/data/cities";
import type { EventEntry } from "@/data/events";
import {
  WAITLIST_MARKET_ALIASES,
  WAITLIST_MARKET_LIMIT,
} from "@/data/waitlistMarkets";
import { getUpcomingDated, hasPurchasableTickets } from "@/utils/eventFilters";
import { DEFAULT_LINEUP } from "@/data/lineup";

export interface CityWaitlistCount {
  citySlug: string;
  count: number;
}

export function isPrefilledCitySource(source: string): boolean {
  return (
    source === "popup" ||
    source === "spice-list" ||
    source.startsWith("spice-list-")
  );
}

/** Normalize city labels for matching, retaining malformed URL encoding literally. */
function normalize(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    /* Keep malformed input literal. */
  }
  return decoded
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const aliases = new Map<string, string>();
for (const city of Object.values(cities)) {
  for (const name of [
    city.slug,
    city.displayName,
    city.addressLocality,
    city.areaServed,
    `${city.addressLocality} ${city.addressRegion}`,
  ]) {
    const key = normalize(name);
    // Ambiguous names need a slug or region rather than guessing a city.
    aliases.set(
      key,
      aliases.has(key) && aliases.get(key) !== city.slug ? "" : city.slug,
    );
  }
}
for (const [slug, names] of Object.entries(WAITLIST_MARKET_ALIASES)) {
  for (const name of names) aliases.set(normalize(name), slug);
}

/** Resolve explicit city interest first, then entered location. Never infer from IP data. */
export function resolveWaitlistMarket(
  slug: string,
  city = "",
): string | undefined {
  const canonical = Object.hasOwn(cities, slug)
    ? slug
    : aliases.get(normalize(city));
  return canonical ? aliases.get(normalize(canonical)) || canonical : undefined;
}

/** Deduplicate explicit city demand across leads and applications, excluding test/deleted records. */
export function rankWaitlistCities(
  leads: Array<Record<string, unknown>>,
): CityWaitlistCount[] {
  const emailsByCity = new Map<string, Set<string>>();
  for (const lead of leads) {
    const source =
      typeof lead.source === "string" ? lead.source.trim().toLowerCase() : "";
    if (
      lead.deletedAt ||
      ["claude-verification-test", "codex-production-check"].includes(source)
    )
      continue;
    const rawEmail =
      typeof lead.emailNormalized === "string" && lead.emailNormalized.trim()
        ? lead.emailNormalized
        : lead.email;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email === SMOKE_TEST_EMAIL ||
      isSyntheticSubmission(email)
    )
      continue;
    const slug =
      typeof lead.sourceCitySlug === "string"
        ? lead.sourceCitySlug.trim().toLowerCase()
        : "";
    // These legacy capture flows stored IP prefills as city without provenance.
    // Only their explicit market slug is reliable enough to rank.
    const rawCity =
      !isPrefilledCitySource(source) && typeof lead.city === "string"
        ? lead.city
        : "";
    const citySlug = resolveWaitlistMarket(slug, rawCity);
    if (!citySlug) continue;
    const emails = emailsByCity.get(citySlug) ?? new Set<string>();
    emails.add(email);
    emailsByCity.set(citySlug, emails);
  }
  return [...emailsByCity]
    .map(([citySlug, emails]) => ({ citySlug, count: emails.size }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        cities[a.citySlug].displayName.localeCompare(
          cities[b.citySlug].displayName,
        ),
    );
}

/** Select five markets by demand, then present dated waitlists before undated ones. */
export function selectWaitlistCards(
  counts: CityWaitlistCount[],
  events: EventEntry[],
  todayISO = new Date().toISOString().slice(0, 10),
  now = new Date(),
): EventEntry[] {
  const upcoming = getUpcomingDated(events, todayISO);
  const ticketed = new Set(
    upcoming
      .filter((event) => hasPurchasableTickets(event, now))
      .map((event) => resolveWaitlistMarket(event.citySlug ?? "", event.city)),
  );
  return counts
    .filter(
      ({ citySlug, count }) =>
        count > 0 &&
        Object.hasOwn(cities, citySlug) &&
        resolveWaitlistMarket(citySlug) === citySlug &&
        !ticketed.has(citySlug),
    )
    .sort(
      (a, b) =>
        b.count - a.count ||
        cities[a.citySlug].displayName.localeCompare(
          cities[b.citySlug].displayName,
        ),
    )
    .slice(0, WAITLIST_MARKET_LIMIT)
    .map(({ citySlug }): EventEntry => {
      const dated = upcoming.find(
        (event) =>
          !event.soldOut &&
          resolveWaitlistMarket(event.citySlug ?? "", event.city) === citySlug,
      );
      if (dated) return dated;
      const city = cities[citySlug];
      return {
        city: city.addressLocality,
        citySlug,
        state: city.addressRegion,
        stateAbbr: city.addressRegion,
        slug: `${citySlug}-waitlist`,
        date: "",
        description: "",
        lineup: DEFAULT_LINEUP,
        ticketSource: "none",
        url: "",
      };
    })
    .sort((a, b) =>
      a.isoDate && b.isoDate
        ? a.isoDate.localeCompare(b.isoDate)
        : a.isoDate
          ? -1
          : b.isoDate
            ? 1
            : 0,
    );
}
