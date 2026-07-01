import type { EventEntry } from "@/data/events";
import { nyOffset } from "@/utils/timezone";

const EVENT_DESCRIPTION =
  "America's #1 live desi dating show where two real South Asian singles go on a blind date in front of 250 people. Hosted by comedians Surbhi and Wyatt. Singles mixer follows every show.";

function subtractMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m - mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Build an array of individual Event JSON-LD strings from a list of events.
 * Only events with an isoDate and venue produce schema output.
 */
export function buildEventSchemas(eventsList: EventEntry[]): string[] {
  return eventsList
    .filter((e) => !e.hidden && e.isoDate && e.venue && e.url && e.url !== "#")
    .map((e) => {
      const start = e.startTime ?? "20:00";
      const end = e.endTime ?? "22:00";
      const missing = [
        !e.price && "price",
        !e.startTime && "startTime",
        !e.endTime && "endTime",
      ].filter(Boolean);
      if (missing.length > 0) {
        throw new Error(
          `[eventSchema] incomplete data for ${e.isoDate} ${e.city}: missing ${missing.join(", ")}`,
        );
      }
      const venue = e.venue!;
      const address: Record<string, string> = {
        "@type": "PostalAddress",
        addressLocality: venue.addressLocality,
        addressRegion: venue.addressRegion,
        addressCountry: venue.addressCountry,
      };
      if (venue.streetAddress) address.streetAddress = venue.streetAddress;
      if (venue.postalCode) address.postalCode = venue.postalCode;

      const door = subtractMinutes(start, 30);
      return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ComedyEvent",
        name: "Garam Masala Dating | Live Comedy Dating Show",
        startDate: `${e.isoDate}T${start}:00${nyOffset(e.isoDate!, start)}`,
        endDate: `${e.isoDate}T${end}:00${nyOffset(e.isoDate!, end)}`,
        doorTime: `${e.isoDate}T${door}:00${nyOffset(e.isoDate!, door)}`,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        maximumAttendeeCapacity: 250,
        typicalAgeRange: "21-",
        isAccessibleForFree: false,
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
        performer: [
          {
            "@type": "Person",
            name: "Surbhi",
            url: "https://www.instagram.com/lordmakemetaller/",
          },
          {
            "@type": "Person",
            name: "Wyatt Feegrado",
            url: "https://www.instagram.com/wyattfeegrado/",
          },
        ],
        offers: {
          "@type": "Offer",
          url: e.url,
          price: e.price ?? "15",
          priceCurrency: "USD",
          availability: e.soldOut
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
          ...(e.onSaleAt ? { validFrom: e.onSaleAt } : {}),
        },
        image: "https://garammasaladating.com/og-image.jpg",
        superEvent: {
          "@type": "EventSeries",
          "@id": "https://garammasaladating.com/#event-series",
        },
      });
    });
}
