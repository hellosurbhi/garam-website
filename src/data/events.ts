const TODAY_ISO = new Date().toISOString().slice(0, 10);

export interface EventVenue {
  name: string;
  streetAddress?: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string;
  addressCountry: string;
}

export interface EventEntry {
  date: string;
  city: string;
  state: string;
  stateAbbr: string;
  citySlug?: string; // Stable slug matching src/data/cities key (e.g. "manhattan")
  url: string;
  hidden?: boolean;
  isoDate?: string; // YYYY-MM-DD — present only for events with a specific date
  startTime?: string; // HH:MM 24h format, ET (default: "20:00")
  endTime?: string; // HH:MM 24h format, ET (default: "22:00")
  venue?: EventVenue;
  price?: string; // USD amount, e.g. "15"
  soldOut?: boolean; // Machine-readable sold-out flag; do not use tagline for control flow
  tagline?: string; // Short status line shown on the card (e.g. "Selling fast")
  eventbriteId?: string; // Numeric Eventbrite event ID — enables modal checkout widget
  onSaleAt?: string; // ISO 8601 UTC datetime — card shows pre-sale notify state until this moment
  timezone?: string; // IANA timezone identifier, e.g. "America/New_York" (default: "America/New_York")
  status?: "canceled"; // Canceled shows stay in this file forever; every surface hides them
  previousDate?: string; // YYYY-MM-DD the show was originally scheduled for, set on reschedule
  note?: string; // Human log note, e.g. "Canceled", "Moved from Aug 2"; see EVENTS-HISTORY.md
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
    url: "https://www.eventbrite.com/e/garam-masala-dating-a-belated-valentines-day-tickets-1982103088695",
    isoDate: "2026-02-22",
    previousDate: "2026-02-28",
    note: "Moved from Feb 28",
    venue: VENUE_TOP_SECRET,
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
    url: "https://www.eventbrite.com/e/garam-masala-dating-live-in-san-diego-tickets-1983622967694",
    isoDate: "2026-03-07",
    venue: {
      name: "San Diego Venue",
      addressLocality: "San Diego",
      addressRegion: "CA",
      addressCountry: "US",
    },
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
    url: "https://www.eventbrite.com/e/garam-masala-dating-st-patricks-day-tickets-1982103088695",
    isoDate: "2026-03-15",
    previousDate: "2026-03-14",
    note: "Moved from Mar 14",
    venue: VENUE_TOP_SECRET,
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
    venue: VENUE_DC_COMEDY_LOFT,
    url: "https://www.dccomedyloft.com/shows/378527",
    isoDate: "2026-08-30",
    startTime: "20:00",
    endTime: "22:00",
    price: "15",
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

export const comingSoonEvents: EventEntry[] = TBA_CITIES.map((city) => ({
  date: "TBA",
  city: city.city,
  state: city.state,
  stateAbbr: city.stateAbbr,
  citySlug: city.citySlug,
  url: "",
  tagline: "Coming soon",
}));

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
