import { SOCIAL_URLS } from "@/data/socials";

export interface FooterLink {
  label: string;
  href: string;
}

export const FOOTER_SHOW_LINKS: FooterLink[] = [
  { label: "New York City", href: "/cities/manhattan" },
  { label: "Jersey City", href: "/cities/jersey-city" },
  { label: "Los Angeles", href: "/cities/los-angeles" },
  { label: "San Francisco", href: "/cities/san-francisco" },
  { label: "San Diego", href: "/cities/san-diego" },
  { label: "All Cities", href: "/cities" },
];

export const FOOTER_INVOLVED_LINKS: FooterLink[] = [
  { label: "Apply to Date on Stage", href: "/apply" },
  { label: "Buy Tickets", href: "/tickets" },
  { label: "Corporate Events", href: "/corporate" },
  { label: "Sponsorship", href: "/sponsorship" },
];

export const FOOTER_EXPLORE_LINKS: FooterLink[] = [
  { label: "FAQ", href: "/faq" },
  { label: "The Journal", href: "/journal" },
  { label: "Meet the Hosts", href: "/hosts" },
  { label: "Contact", href: SOCIAL_URLS.email },
];
