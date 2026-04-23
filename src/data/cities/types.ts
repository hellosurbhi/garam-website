export interface CityCta {
  label: string;
  href: string;
}

export type CityRegion =
  | "US Northeast"
  | "US Southeast"
  | "US Midwest"
  | "US South & Texas"
  | "US West"
  | "Canada"
  | "United Kingdom"
  | "Australia"
  | "Europe"
  | "India"
  | "Southeast Asia"
  | "East Asia"
  | "South Asia"
  | "Africa"
  | "Pacific Islands"
  | "Caribbean";

export interface CityData {
  slug: string;
  displayName: string;
  titleTag: string;
  metaDescription: string;
  h1: string;
  bodyParagraphs: string[];
  ctas: CityCta[];
  /**
   * "active"      — weekly / regular shows running now
   * "coming-soon" — announced or planned, no confirmed date yet
   * "past"        — show already happened
   */
  status: "active" | "coming-soon" | "past";
  /** Label shown on the /cities index card (e.g. "Weekly Shows", "Coming Soon") */
  badgeLabel: string;
  /** For LocalBusiness schema */
  areaServed: string;
  /** Whether to include an Event schema block */
  includeEventSchema: boolean;
  addressLocality: string;
  addressRegion: string;
  /** Two-letter country code (US, CA, GB, AU, etc.) */
  addressCountry: string;
  /** Named venue for Event schema location.name */
  venueName?: string;
  /** ISO 8601 duration for eventSchedule.repeatFrequency */
  eventScheduleFrequency?: string;
  /** Region grouping for the /cities hub page */
  region: CityRegion;
  /** Slugs of 3-5 nearby cities for cross-linking */
  nearbyCities: string[];
  /** One-line community stat shown between eyebrow and H1 (e.g. "175,000 South Asians in the Chicago metro area") */
  communityStats?: string;
  /** Slugs of 2-3 journal articles to cross-link in the "From the Journal" section */
  relatedArticleSlugs?: string[];
  /** City-specific Q&A for the FAQ section and FAQPage JSON-LD schema */
  faqItems?: Array<{ q: string; a: string }>;
}
