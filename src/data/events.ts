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

const VENUE_NEXT_IN_LINE: EventVenue = {
  name: "Next In Line Comedy",
  streetAddress: "1025 Hamilton Street",
  addressLocality: "Philadelphia",
  addressRegion: "PA",
  postalCode: "19123",
  addressCountry: "US",
};

export const events: EventEntry[] = [
  {
    date: "Feb 22",
    city: "Manhattan, New York",
    citySlug: "manhattan",
    url: "https://www.eventbrite.com/e/garam-masala-dating-a-belated-valentines-day-tickets-1982103088695",
    isoDate: "2026-02-22",
    venue: VENUE_TOP_SECRET,
    price: "15",
    soldOut: true,
    tagline: "Sold out",
  },
  {
    date: "Mar 7",
    city: "San Diego",
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
    city: "Manhattan, New York",
    citySlug: "manhattan",
    url: "https://www.eventbrite.com/e/garam-masala-dating-st-patricks-day-tickets-1982103088695",
    isoDate: "2026-03-15",
    venue: VENUE_TOP_SECRET,
    price: "15",
    soldOut: true,
    tagline: "Sold out",
  },
  {
    date: "Apr 4",
    city: "Chicago",
    citySlug: "chicago",
    url: "https://www.eventbrite.com/e/saturday-april-4-garam-masala-dating-tickets-1983144430376",
    hidden: true,
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
    city: "Manhattan, New York",
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
    city: "Jersey City, New Jersey",
    citySlug: "jersey-city",
    url: "https://www.eventbrite.com/e/garam-masala-dating-show-jersey-city-edition-tickets-1986100570270",
    isoDate: "2026-05-03",
    startTime: "18:00",
    endTime: "20:00",
    venue: VENUE_LAUGH_TOUR,
    price: "15",
    eventbriteId: "1986100570270",
  },
  {
    date: "May 10",
    city: "San Francisco, California",
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
    date: "Jun 21",
    city: "Manhattan, New York",
    citySlug: "manhattan",
    url: "https://www.eventbrite.com/e/garam-masala-dating-show-pride-edition-tickets-1987763579375",
    isoDate: "2026-06-21",
    startTime: "18:00",
    endTime: "20:00",
    venue: VENUE_TOP_SECRET,
    price: "15",
    eventbriteId: "1987763579375",
  },
  {
    date: "Jun 25",
    city: "San Francisco, California",
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
    date: "Jul 12",
    city: "Philadelphia, Pennsylvania",
    citySlug: "philadelphia",
    url: "https://www.eventbrite.com/e/garam-masala-1-desi-dating-show-tickets-1989618938805",
    isoDate: "2026-07-12",
    startTime: "19:30",
    endTime: "21:30",
    venue: VENUE_NEXT_IN_LINE,
    price: "15",
    eventbriteId: "1989618938805",
  },
];

// Only show TBA entries for cities with active tour planning (not all 200+ expansion pages).
// These slugs appear as TBA cards on the tickets page and home shows section.
const TBA_CITIES = ["Los Angeles", "San Diego"];

const comingSoonEvents: EventEntry[] = TBA_CITIES.map((city) => ({
  date: "TBA",
  city,
  url: "",
  tagline: "Coming soon",
}));

/** All events: confirmed shows + hand-picked TBA cities */
export const allEvents: EventEntry[] = [...events, ...comingSoonEvents];

/**
 * Returns the canonical display status for an event.
 * Prefers the machine-readable soldOut flag over the tagline so that
 * sold-out shows with no tagline are still surfaced correctly.
 */
export function getEventDisplayStatus(event: EventEntry): string | undefined {
  if (event.soldOut) return "Sold out";
  return event.tagline;
}
