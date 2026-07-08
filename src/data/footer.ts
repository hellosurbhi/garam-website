import { SOCIAL_URLS } from "@/data/socials";
import { cities } from "@/data/cities";
import type { CityData } from "@/data/cities";
import { allEvents, TBA_CITY_SLUGS } from "@/data/events";
import { isEventPast } from "@/utils/eventDate";

export interface FooterLink {
  label: string;
  href: string;
}

const MAX_FOOTER_CITY_LINKS = 6;

function cityLabel(c: CityData): string {
  return c.slug === "manhattan" ? "New York City" : c.displayName;
}

function buildFooterShowLinks(): FooterLink[] {
  // Mirror the tickets page: confirmed upcoming cities first, then TBA cities.
  // allEvents already dedups TBA entries when a confirmed show exists for that city.
  const seen = new Set<string>();
  const slugs: string[] = [];

  for (const e of allEvents) {
    if (!e.citySlug || seen.has(e.citySlug)) continue;
    const isConfirmedUpcoming =
      !e.hidden && e.date !== "TBA" && !isEventPast(e.date) && !!e.url;
    const isTba = !e.hidden && e.date === "TBA";
    if (isConfirmedUpcoming || isTba) {
      seen.add(e.citySlug);
      slugs.push(e.citySlug);
    }
  }

  const links: FooterLink[] = slugs
    .slice(0, MAX_FOOTER_CITY_LINKS)
    .map((slug) => cities[slug])
    .filter((c): c is CityData => c !== undefined)
    .map((c) => ({ label: cityLabel(c), href: `/cities/${c.slug}` }));

  // Fill remaining slots from the same TBA city list used on the tickets page.
  for (const slug of TBA_CITY_SLUGS) {
    if (links.length >= MAX_FOOTER_CITY_LINKS) break;
    if (seen.has(slug)) continue;
    const c = cities[slug];
    if (!c) continue;
    links.push({ label: cityLabel(c), href: `/cities/${c.slug}` });
    seen.add(slug);
  }

  links.push({ label: "All Cities", href: "/cities" });
  return links;
}

export const FOOTER_SHOW_LINKS: FooterLink[] = buildFooterShowLinks();

export const FOOTER_INVOLVED_LINKS: FooterLink[] = [
  { label: "Apply to Date on Stage", href: "/apply" },
  { label: "Buy Tickets", href: "/tickets" },
  { label: "Corporate Events", href: "/corporate" },
  { label: "Parties & Celebrations", href: "/celebrate" },
  { label: "South Asian Events", href: "/desi-events" },
  { label: "Sponsorship", href: "/sponsorship" },
];

export const FOOTER_EXPLORE_LINKS: FooterLink[] = [
  { label: "Links", href: "/links" },
  { label: "FAQ", href: "/faq" },
  { label: "The Journal", href: "/journal" },
  { label: "Meet the Hosts", href: "/hosts" },
  { label: "Press", href: "/press" },
  { label: "Contact", href: SOCIAL_URLS.email },
];
