import type { EventEntry } from "@/data/events";
import { nyOffset } from "@/utils/timezone";

const EVENT_DESCRIPTION =
  "NYC's live comedy dating show where two real singles go on a blind date in front of 250 people. Hosted by comedians Surbhi and Wyatt. Singles mixer follows every show.";

/**
 * Build an array of individual Event JSON-LD strings from a list of events.
 * Only events with an isoDate and venue produce schema output.
 */
export function buildEventSchemas(eventsList: EventEntry[]): string[] {
  return eventsList
    .filter((e) => !e.hidden && e.isoDate && e.venue)
    .map((e) => {
      const start = e.startTime ?? "20:00";
      const end = e.endTime ?? "22:00";
      const venue = e.venue!;
      const address: Record<string, string> = {
        "@type": "PostalAddress",
        addressLocality: venue.addressLocality,
        addressRegion: venue.addressRegion,
        addressCountry: venue.addressCountry,
      };
      if (venue.streetAddress) address.streetAddress = venue.streetAddress;
      if (venue.postalCode) address.postalCode = venue.postalCode;

      return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Event",
        name: "Garam Masala Dating — Live Comedy Dating Show",
        startDate: `${e.isoDate}T${start}:00${nyOffset(e.isoDate!, start)}`,
        endDate: `${e.isoDate}T${end}:00${nyOffset(e.isoDate!, end)}`,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: venue.name,
          address,
        },
        description: EVENT_DESCRIPTION,
        organizer: {
          "@type": "Organization",
          name: "Garam Masala Dating",
          url: "https://garammasaladating.com",
        },
        offers: {
          "@type": "Offer",
          url: e.url,
          price: e.price ?? "15",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        image: "https://garammasaladating.com/og-image.jpg",
      });
    });
}
