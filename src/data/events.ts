// WHY: relative imports, not the "@/" alias, because this file is imported
// directly by astro.config.mjs (for sitemap generation) via a relative path.
// Astro/Vite's config-loading module runner does not apply the vite.resolve.alias
// defined inside that same config file when resolving the config's own transitive
// dependency graph, so an "@/" import here fails with "Cannot find module" during
// `astro build`/`astro check`. cities/index.ts and journal/index.ts (also imported
// directly by astro.config.mjs) follow the same relative-import convention for the
// same reason. If this file stops being imported directly by astro.config.mjs,
// this restriction no longer applies.
import type { PerformerId } from "./lineup";
import { DEFAULT_LINEUP } from "./lineup";

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export interface EventVenue {
  name: string;
  streetAddress?: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string;
  addressCountry: string;
}

/**
 * Who actually owns the Eventbrite listing for this show.
 *
 * "eventbrite-owned": ticketed through our own Eventbrite account. We can pull
 * order data and Eventbrite's native pixel/webhooks are ours to configure.
 * "external": promoter or venue runs checkout (their own Eventbrite account,
 * or a non-Eventbrite ticketing platform like City Winery/DC Comedy Loft).
 * We have no order-level access, so Purchase can never be tracked
 * server-side for these: only InitiateCheckout (browser + CAPI) applies.
 *
 * This can't be inferred from `eventbriteId` alone: a promoter-run show
 * (e.g. Los Angeles) can still carry a real, public Eventbrite ID that
 * belongs to someone else's account. Every event must set this explicitly.
 */
export type TicketSource = "eventbrite-owned" | "external";

export interface EventEntry {
  date: string;
  city: string;
  state: string;
  stateAbbr: string;
  citySlug?: string; // Stable slug matching src/data/cities key (e.g. "manhattan")
  /** Unique slug for this specific show's /events/[slug] landing page. */
  slug: string;
  /** Overview copy for the per-event landing page. Never rendered as a price/CTA. */
  description: string;
  /** Performers appearing on stage for this show. Defaults to both hosts. */
  lineup: PerformerId[];
  ticketSource: TicketSource;
  url: string;
  hidden?: boolean;
  isoDate?: string; // YYYY-MM-DD — present only for events with a specific date
  startTime?: string; // HH:MM 24h format, ET (default: "20:00")
  endTime?: string; // HH:MM 24h format, ET (default: "22:00")
  venue?: EventVenue;
  price?: string; // USD amount, e.g. "15": JSON-LD (offers.price) only, never rendered in UI
  soldOut?: boolean; // Machine-readable sold-out flag; do not use tagline for control flow
  tagline?: string; // Short status line shown on the card (e.g. "Selling fast")
  eventbriteId?: string; // Numeric Eventbrite event ID
  onSaleAt?: string; // ISO 8601 UTC datetime — card shows pre-sale notify state until this moment
  timezone?: string; // IANA timezone identifier, e.g. "America/New_York" (default: "America/New_York")
  status?: "canceled"; // Canceled shows stay in this file forever; every surface hides them
  previousDate?: string; // YYYY-MM-DD the show was originally scheduled for, set on reschedule
  note?: string; // Human log note, e.g. "Canceled", "Moved from Aug 2"; see EVENTS-HISTORY.md
}

/** Default per-event slug: stable, unique, and human-readable in a URL. */
function buildEventSlug(citySlug: string, isoDate?: string): string {
  return isoDate ? `${citySlug}-${isoDate}` : `${citySlug}-tba`;
}

const VENUE_TOP_SECRET: EventVenue = {
  name: "Top Secret Comedy Club",
  streetAddress: "44 Avenue A",
  addressLocality: "New York",
  addressRegion: "NY",
  postalCode: "10009",
  addressCountry: "US",
};

const VENUE_LAUGH_TOUR: EventVenue = {
  name: "The Laugh Tour Comedy Club",
  streetAddress: "555 Washington Blvd",
  addressLocality: "Jersey City",
  addressRegion: "NJ",
  postalCode: "07310",
  addressCountry: "US",
};

const VENUE_FAIGHT_COLLECTIVE: EventVenue = {
  name: "The Faight Collective",
  streetAddress: "473A Haight St",
  addressLocality: "San Francisco",
  addressRegion: "CA",
  postalCode: "94117",
  addressCountry: "US",
};

const VENUE_LYRIC_HYPERION: EventVenue = {
  name: "Lyric Hyperion Theater & Cafe",
  streetAddress: "2106 Hyperion Ave",
  addressLocality: "Los Angeles",
  addressRegion: "CA",
  postalCode: "90027",
  addressCountry: "US",
};

const VENUE_CITY_WINERY_NYC: EventVenue = {
  name: "The Loft at City Winery NYC",
  streetAddress: "25 11th Ave",
  addressLocality: "New York",
  addressRegion: "NY",
  postalCode: "10011",
  addressCountry: "US",
};

const VENUE_ELEPHANT_CASTLE: EventVenue = {
  name: "Elephant & Castle",
  streetAddress: "161 Devonshire Street",
  addressLocality: "Boston",
  addressRegion: "MA",
  postalCode: "02110",
  addressCountry: "US",
};

const VENUE_NEXT_IN_LINE: EventVenue = {
  name: "Next In Line Comedy",
  streetAddress: "1025 Hamilton Street",
  addressLocality: "Philadelphia",
  addressRegion: "PA",
  postalCode: "19123",
  addressCountry: "US",
};

const VENUE_KOMIC_KARMA: EventVenue = {
  name: "Komic Karma Entertainment",
  addressLocality: "North Brunswick Township",
  addressRegion: "NJ",
  addressCountry: "US",
};

const VENUE_DC_COMEDY_LOFT: EventVenue = {
  name: "DC Comedy Loft",
  addressLocality: "Washington",
  addressRegion: "DC",
  addressCountry: "US",
};

export const events: EventEntry[] = [
  {
    date: "Feb 22",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-02-22"),
    description:
      "A belated Valentine's Day edition of America's #1 live desi comedy dating show at Top Secret Comedy Club. Two real singles go on a blind date on stage while Surbhi and Wyatt run the room. This show has sold out.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-dating-a-belated-valentines-day-tickets-1982103088695",
    isoDate: "2026-02-22",
    previousDate: "2026-02-28",
    note: "Moved from Feb 28",
    venue: VENUE_TOP_SECRET,
    startTime: "18:00",
    endTime: "20:00",
    price: "15",
    soldOut: true,
    tagline: "Sold out",
  },
  {
    date: "Mar 7",
    city: "San Diego",
    state: "California",
    stateAbbr: "CA",
    citySlug: "san-diego",
    slug: buildEventSlug("san-diego", "2026-03-07"),
    description:
      "Garam Masala Dating's San Diego debut. Two real singles, one blind date, one live audience voting on the outcome. This show has sold out.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-dating-live-in-san-diego-tickets-1983622967694",
    isoDate: "2026-03-07",
    venue: {
      name: "San Diego Venue",
      addressLocality: "San Diego",
      addressRegion: "CA",
      addressCountry: "US",
    },
    startTime: "18:00",
    endTime: "20:00",
    price: "15",
    soldOut: true,
    tagline: "Sold out",
  },
  {
    date: "Mar 15",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-03-15"),
    description:
      "A St. Patrick's Day edition of Garam Masala Dating at Top Secret Comedy Club. Real singles, real chaos, hosted by Surbhi and Wyatt. This show has sold out.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-dating-st-patricks-day-tickets-1982103088695",
    isoDate: "2026-03-15",
    previousDate: "2026-03-14",
    note: "Moved from Mar 14",
    venue: VENUE_TOP_SECRET,
    startTime: "18:00",
    endTime: "20:00",
    price: "15",
    soldOut: true,
    tagline: "Sold out",
  },
  {
    date: "Apr 4",
    city: "Chicago",
    state: "Illinois",
    stateAbbr: "IL",
    citySlug: "chicago",
    slug: buildEventSlug("chicago", "2026-04-04"),
    description:
      "Garam Masala Dating comes to Chicago for a night of live comedy and blind dating on stage. This show has sold out.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/saturday-april-4-garam-masala-dating-tickets-1983144430376",
    hidden: true,
    note: "Hidden from site Mar 27 2026, reason unrecorded",
    isoDate: "2026-04-04",
    venue: {
      name: "Chicago Venue",
      addressLocality: "Chicago",
      addressRegion: "IL",
      addressCountry: "US",
    },
    price: "15",
    soldOut: true,
    tagline: "Sold out",
  },
  {
    date: "Apr 19",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-04-19"),
    description:
      "A 420 themed edition of Garam Masala Dating at Top Secret Comedy Club. Two singles meet for the first time on stage while the audience decides if sparks fly.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-dating-420-blazin-in-love-tickets-1985330936274",
    isoDate: "2026-04-19",
    startTime: "18:00",
    endTime: "20:00",
    venue: VENUE_TOP_SECRET,
    price: "15",
    tagline: "Low tickets, grab yours now",
    eventbriteId: "1985330936274",
  },
  {
    date: "May 3",
    city: "Jersey City",
    state: "New Jersey",
    stateAbbr: "NJ",
    citySlug: "jersey-city",
    slug: buildEventSlug("jersey-city", "2026-05-03"),
    description:
      "Garam Masala Dating's Jersey City edition at The Laugh Tour Comedy Club. A live blind date, real singles, and a singles mixer after the show.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-dating-show-jersey-city-edition-tickets-1986100570270",
    isoDate: "2026-05-03",
    previousDate: "2026-04-26",
    note: "Moved from Apr 26",
    startTime: "18:00",
    endTime: "20:00",
    venue: VENUE_LAUGH_TOUR,
    price: "15",
    eventbriteId: "1986100570270",
  },
  {
    date: "May 10",
    city: "San Francisco",
    state: "California",
    stateAbbr: "CA",
    citySlug: "san-francisco",
    slug: buildEventSlug("san-francisco", "2026-05-10"),
    description:
      "Garam Masala Dating comes to The Faight Collective in San Francisco for a night of live comedy and real blind dates on stage.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-dating-show-san-francisco-tickets-1988516311818",
    isoDate: "2026-05-10",
    startTime: "18:30",
    endTime: "20:30",
    venue: VENUE_FAIGHT_COLLECTIVE,
    price: "15",
    eventbriteId: "1988516311818",
  },
  {
    date: "May 31",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-05-31"),
    description:
      "A May flowers bring June bridal showers edition of Garam Masala Dating at Top Secret Comedy Club, with two real singles on a blind date in front of a packed house.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-comedy-dating-show-may-flowers-bring-june-bridal-showers-tickets-1990168950906",
    isoDate: "2026-05-31",
    startTime: "18:30",
    endTime: "20:30",
    venue: VENUE_TOP_SECRET,
    price: "15",
    eventbriteId: "1990168950906",
  },
  {
    date: "Jun 7",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-06-07"),
    description:
      "A Summer of Love edition of Garam Masala Dating at Top Secret Comedy Club. Real singles, live comedy, and a singles mixer to close out the night.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-comedy-dating-show-summer-of-love-tickets-1990821381343",
    isoDate: "2026-06-07",
    startTime: "18:00",
    endTime: "20:00",
    venue: VENUE_TOP_SECRET,
    price: "15",
    eventbriteId: "1990821381343",
  },
  {
    date: "Jun 21",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-06-21"),
    description:
      "A Pride edition of Garam Masala Dating at Top Secret Comedy Club, celebrating every kind of love with a live blind date on stage.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-dating-show-pride-edition-tickets-1987763579375",
    isoDate: "2026-06-21",
    previousDate: "2026-06-14",
    note: "Moved from Jun 14",
    startTime: "18:00",
    endTime: "20:00",
    venue: VENUE_TOP_SECRET,
    price: "15",
    eventbriteId: "1987763579375",
  },
  {
    date: "Jun 25",
    city: "San Francisco",
    state: "California",
    stateAbbr: "CA",
    citySlug: "san-francisco",
    slug: buildEventSlug("san-francisco", "2026-06-25"),
    description:
      "A Seed Round edition of Garam Masala Dating at The Faight Collective in San Francisco, with two real singles pitching for a second date.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-comedy-dating-show-san-francisco-seed-round-tickets-1989633237573",
    isoDate: "2026-06-25",
    startTime: "18:30",
    endTime: "20:30",
    venue: VENUE_FAIGHT_COLLECTIVE,
    price: "15",
    eventbriteId: "1989633237573",
  },
  {
    date: "TBA",
    city: "Edison",
    state: "New Jersey",
    stateAbbr: "NJ",
    citySlug: "edison",
    slug: buildEventSlug("edison"),
    description:
      "Garam Masala Dating comes to Edison, New Jersey with Komic Karma Entertainment. Tickets are not on sale yet, join the list to be first to know when they drop.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "",
    hidden: true,
    note: "Jul 11 date canceled Jul 7 2026; taken off notify me Aug 14 2026",
    venue: VENUE_KOMIC_KARMA,
    price: "15",
    eventbriteId: "1992185715102",
  },
  {
    date: "Jul 19",
    city: "Los Angeles",
    state: "California",
    stateAbbr: "CA",
    citySlug: "los-angeles",
    slug: buildEventSlug("los-angeles", "2026-07-19"),
    description:
      "Garam Masala Dating comes to the Lyric Hyperion Theater in Los Angeles for a night of live comedy and blind dating on stage.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-tickets-1989799702474",
    isoDate: "2026-07-19",
    startTime: "18:30",
    endTime: "20:30",
    venue: VENUE_LYRIC_HYPERION,
    price: "15",
    eventbriteId: "1989799702474",
  },
  {
    date: "Jul 26",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-07-26"),
    description:
      "An All Stars edition of Garam Masala Dating at The Loft at City Winery NYC, bringing back fan favorite daters for one more round.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://tickets.citywinery.com/event/garam-masala-comedy-dating-show-all-stars-editio-ownqgw",
    isoDate: "2026-07-26",
    startTime: "19:00",
    endTime: "21:00",
    venue: VENUE_CITY_WINERY_NYC,
    price: "15",
  },
  {
    date: "Aug 13",
    city: "Boston",
    state: "Massachusetts",
    stateAbbr: "MA",
    citySlug: "boston",
    slug: buildEventSlug("boston", "2026-08-02"),
    description:
      "A Spilling Tea in Boston edition of Garam Masala Dating at Elephant & Castle, with two real singles on a blind date in front of a live audience.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-comedy-dating-show-spilling-tea-in-boston-tickets-1992075859521",
    isoDate: "2026-08-13",
    previousDate: "2026-08-02",
    note: "Moved from Aug 2, start moved from 6 PM to 7 PM",
    startTime: "19:00",
    endTime: "21:00",
    venue: VENUE_ELEPHANT_CASTLE,
    price: "15",
    eventbriteId: "1992075859521",
  },
  {
    date: "Aug 16",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-08-16"),
    description:
      "A Cuffing Season Coming edition of Garam Masala Dating at Top Secret Comedy Club, just in time to find your person before the cold sets in.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-comedy-dating-show-cuffing-season-coming-tickets-1990583884985",
    isoDate: "2026-08-16",
    previousDate: "2026-08-02",
    startTime: "18:30",
    endTime: "20:30",
    venue: VENUE_TOP_SECRET,
    price: "15",
    eventbriteId: "1990583884985",
    status: "canceled",
    note: "Canceled Aug 14 2026; had moved from Aug 2",
  },
  {
    date: "Aug 28",
    city: "Philadelphia",
    state: "Pennsylvania",
    stateAbbr: "PA",
    citySlug: "philadelphia",
    slug: buildEventSlug("philadelphia", "2026-08-28"),
    description:
      "Garam Masala Dating's Philadelphia debut at Next In Line Comedy, with two real singles on a blind date in front of a live audience.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://www.eventbrite.com/e/garam-masala-1-desi-dating-show-tickets-1989618938805?aff=oddtdtcreator",
    isoDate: "2026-08-28",
    previousDate: "2026-07-12",
    note: "Jul 12 date canceled Jul 7, rescheduled to Aug 28 with 7 PM start",
    startTime: "19:00",
    endTime: "21:00",
    venue: VENUE_NEXT_IN_LINE,
    price: "15",
    eventbriteId: "1989618938805",
  },
  {
    date: "Aug 30",
    city: "Washington",
    state: "District of Columbia",
    stateAbbr: "DC",
    citySlug: "washington-dc",
    slug: buildEventSlug("washington-dc", "2026-08-30"),
    description:
      "Garam Masala Dating comes to DC Comedy Loft in Washington, D.C. for a night of live comedy and real blind dates on stage.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    venue: VENUE_DC_COMEDY_LOFT,
    url: "https://www.dccomedyloft.com/shows/378527",
    isoDate: "2026-08-30",
    startTime: "20:00",
    endTime: "22:00",
    price: "15",
  },
  {
    date: "Oct 11",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: buildEventSlug("manhattan", "2026-10-11"),
    description:
      "Another All Stars edition of Garam Masala Dating at The Loft at City Winery NYC, bringing back fan favorite daters for a second round on stage.",
    lineup: DEFAULT_LINEUP,
    ticketSource: "external",
    url: "https://tickets.citywinery.com/event/garam-masala-comedy-dating-show-all-stars-editio-suakfs",
    isoDate: "2026-10-11",
    startTime: "19:00",
    endTime: "21:00",
    venue: VENUE_CITY_WINERY_NYC,
    price: "15",
    onSaleAt: "2026-08-20T19:00:00Z",
  },
];

// Only show TBA entries for cities with active tour planning (not all 200+ expansion pages).
// These slugs appear as notify-me TBA cards on the tickets page and home shows section.
// Standing roster per owner instruction 2026-08-14: LA, SF and New York, always.
// Chicago and Houston removed the same day (see EVENTS-HISTORY.md).
const TBA_CITIES = [
  {
    city: "Los Angeles",
    state: "California",
    stateAbbr: "CA",
    citySlug: "los-angeles",
  },
  {
    city: "San Francisco",
    state: "California",
    stateAbbr: "CA",
    citySlug: "san-francisco",
  },
  {
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
  },
];

export const TBA_CITY_SLUGS: string[] = TBA_CITIES.map((c) => c.citySlug);

export const comingSoonEvents: EventEntry[] = TBA_CITIES.map(
  (city): EventEntry => ({
    date: "TBA",
    city: city.city,
    state: city.state,
    stateAbbr: city.stateAbbr,
    citySlug: city.citySlug,
    slug: buildEventSlug(city.citySlug),
    description: `Garam Masala Dating hasn't announced a date in ${city.city} yet. Join the list to be first to know when tickets drop.`,
    lineup: DEFAULT_LINEUP,
    // No show exists yet, so there is no Eventbrite account to own.
    ticketSource: "external",
    url: "",
    tagline: "Coming soon",
  }),
);

/**
 * True when an event may appear anywhere on the public site.
 * Canceled shows are permanent records (see EVENTS-HISTORY.md), never
 * deleted from this file; this predicate is what keeps them off every
 * surface. All upcoming/visible filters must go through it.
 */
export function isDisplayable(
  e: Pick<EventEntry, "hidden" | "status">,
): boolean {
  return !e.hidden && e.status !== "canceled";
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

/** All events: confirmed shows + TBA cities (suppressed when city has an upcoming confirmed show) */
export const allEvents: EventEntry[] = computeAllEvents(
  events,
  comingSoonEvents,
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
