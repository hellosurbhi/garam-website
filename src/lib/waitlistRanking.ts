import { isSyntheticSubmission } from "@/lib/syntheticMonitor";
import { SMOKE_TEST_EMAIL } from "./smokeTestIdentity";
import { cities } from "@/data/cities";
import type { EventEntry } from "@/data/events";
import { DEFAULT_LINEUP } from "@/data/lineup";

export interface CityWaitlistCount {
  citySlug: string;
  count: number;
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
for (const [name, slug] of Object.entries({
  "new york": "manhattan",
  "new york city": "manhattan",
  nyc: "manhattan",
  sf: "san-francisco",
  "washington dc nova": "washington-dc",
}))
  aliases.set(name, slug);

/** Count unique normalized emails for explicitly requested cities, excluding smoke fixtures and unrelated signup sources. */
export function rankWaitlistCities(
  leads: Array<Record<string, unknown>>,
): CityWaitlistCount[] {
  const emailsByCity = new Map<string, Set<string>>();
  for (const lead of leads) {
    const source =
      typeof lead.source === "string" ? lead.source.toLowerCase() : "";
    if (
      !source.includes("notify") &&
      !source.includes("waitlist") &&
      !["city-page", "tickets-city-request", "request-city"].includes(source)
    )
      continue;
    const email =
      typeof lead.email === "string" ? lead.email.trim().toLowerCase() : "";
    if (!email || email === SMOKE_TEST_EMAIL || isSyntheticSubmission(email))
      continue;
    const slug =
      typeof lead.sourceCitySlug === "string"
        ? lead.sourceCitySlug.trim().toLowerCase()
        : "";
    const rawCity = typeof lead.city === "string" ? lead.city : "";
    const citySlug = Object.hasOwn(cities, slug)
      ? slug
      : aliases.get(normalize(rawCity)) ||
        aliases.get(normalize(rawCity.split(",")[0]));
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

/** Build the ten highest-demand undated cards, excluding scheduled cities and breaking ties alphabetically. */
export function selectWaitlistCards(
  counts: CityWaitlistCount[],
  upcoming: EventEntry[],
): EventEntry[] {
  const scheduled = new Set(upcoming.map((event) => event.citySlug));
  return counts
    .filter(
      ({ citySlug }) =>
        Object.hasOwn(cities, citySlug) && !scheduled.has(citySlug),
    )
    .sort(
      (a, b) =>
        b.count - a.count ||
        cities[a.citySlug].displayName.localeCompare(
          cities[b.citySlug].displayName,
        ),
    )
    .slice(0, 10)
    .map(({ citySlug }) => {
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
    });
}
