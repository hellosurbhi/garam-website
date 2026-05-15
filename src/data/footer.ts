import { SOCIAL_URLS } from "@/data/socials";
import { activeCities } from "@/data/cities/active";
import { cities } from "@/data/cities";
import type { CityData } from "@/data/cities";
import { citySlugsWithUpcomingEvents } from "@/utils/cityEvents";

export interface FooterLink {
  label: string;
  href: string;
}

function cityLabel(c: CityData): string {
  return c.slug === "manhattan" ? "New York City" : c.displayName;
}

function buildFooterShowLinks(): FooterLink[] {
  const announcedSlugs = citySlugsWithUpcomingEvents();
  const announcedSet = new Set(announcedSlugs);

  const announcedLinks: FooterLink[] = announcedSlugs
    .map((slug) => cities[slug])
    .filter((c): c is CityData => c !== undefined)
    .map((c) => ({ label: cityLabel(c), href: `/cities/${c.slug}` }));

  const links: FooterLink[] = [...announcedLinks];

  // Backfill from featured active.ts cities (insertion order = priority)
  if (links.length < 5) {
    for (const slug of Object.keys(activeCities)) {
      if (links.length >= 5) break;
      if (announcedSet.has(slug)) continue;
      const c = activeCities[slug];
      links.push({ label: cityLabel(c), href: `/cities/${c.slug}` });
    }
  }

  links.push({ label: "All Cities", href: "/cities" });
  return links;
}

export const FOOTER_SHOW_LINKS: FooterLink[] = buildFooterShowLinks();

export const FOOTER_INVOLVED_LINKS: FooterLink[] = [
  { label: "Apply to Date on Stage", href: "/apply" },
  { label: "Buy Tickets", href: "/tickets" },
  { label: "Corporate Events", href: "/corporate" },
  { label: "Sponsorship", href: "/sponsorship" },
];

export const FOOTER_EXPLORE_LINKS: FooterLink[] = [
  { label: "Links", href: "/links" },
  { label: "FAQ", href: "/faq" },
  { label: "The Journal", href: "/journal" },
  { label: "Meet the Hosts", href: "/hosts" },
  { label: "Contact", href: SOCIAL_URLS.email },
];
