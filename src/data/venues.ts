/**
 * Venue presets for the admin Shows editor (issue 337).
 *
 * Moved verbatim from src/data/events.ts when event records started living
 * in events.published.json. Venue constants are permanent records: never
 * delete one, even when no event references it anymore (src/data/CLAUDE.md).
 */
// WHY: relative import, not the "@/" alias: this file sits next to modules
// that astro.config.mjs loads directly, and the config's module runner does
// not apply vite.resolve.alias (see the note at the top of events.ts).
import type { EventVenue } from "./eventsSnapshot";

export const VENUE_TOP_SECRET: EventVenue = {
  name: "Top Secret Comedy Club",
  streetAddress: "44 Avenue A",
  addressLocality: "New York",
  addressRegion: "NY",
  postalCode: "10009",
  addressCountry: "US",
};

export const VENUE_LAUGH_TOUR: EventVenue = {
  name: "The Laugh Tour Comedy Club",
  streetAddress: "555 Washington Blvd",
  addressLocality: "Jersey City",
  addressRegion: "NJ",
  postalCode: "07310",
  addressCountry: "US",
};

export const VENUE_FAIGHT_COLLECTIVE: EventVenue = {
  name: "The Faight Collective",
  streetAddress: "473A Haight St",
  addressLocality: "San Francisco",
  addressRegion: "CA",
  postalCode: "94117",
  addressCountry: "US",
};

export const VENUE_LYRIC_HYPERION: EventVenue = {
  name: "Lyric Hyperion Theater & Cafe",
  streetAddress: "2106 Hyperion Ave",
  addressLocality: "Los Angeles",
  addressRegion: "CA",
  postalCode: "90027",
  addressCountry: "US",
};

export const VENUE_CITY_WINERY_NYC: EventVenue = {
  name: "The Loft at City Winery NYC",
  streetAddress: "25 11th Ave",
  addressLocality: "New York",
  addressRegion: "NY",
  postalCode: "10011",
  addressCountry: "US",
};

export const VENUE_ELEPHANT_CASTLE: EventVenue = {
  name: "Elephant & Castle",
  streetAddress: "161 Devonshire Street",
  addressLocality: "Boston",
  addressRegion: "MA",
  postalCode: "02110",
  addressCountry: "US",
};

export const VENUE_NEXT_IN_LINE: EventVenue = {
  name: "Next In Line Comedy",
  streetAddress: "1025 Hamilton Street",
  addressLocality: "Philadelphia",
  addressRegion: "PA",
  postalCode: "19123",
  addressCountry: "US",
};

export const VENUE_LINCOLN_LODGE: EventVenue = {
  name: "The Lincoln Lodge",
  streetAddress: "2040 North Milwaukee Avenue",
  addressLocality: "Chicago",
  addressRegion: "IL",
  postalCode: "60647",
  addressCountry: "US",
};

export const VENUE_KOMIC_KARMA: EventVenue = {
  name: "Komic Karma Entertainment",
  addressLocality: "North Brunswick Township",
  addressRegion: "NJ",
  addressCountry: "US",
};

export const VENUE_DC_COMEDY_LOFT: EventVenue = {
  name: "DC Comedy Loft",
  addressLocality: "Washington",
  addressRegion: "DC",
  addressCountry: "US",
};
