import { isDisplayable } from "@/data/events";
import type { EventEntry } from "@/data/events";
import { nyOffset } from "@/utils/timezone";
import { addMinutesToTime } from "@/utils/eventDate";
import { BASE } from "@/utils/breadcrumbs";

const EVENT_DESCRIPTION =
  "America's #1 live desi comedy dating show where two real South Asian singles go on a blind date in front of 250 people. Hosted by comedians Surbhi and Wyatt. Singles mixer follows every show.";

/**
 * Build an array of individual Event JSON-LD strings from a list of events.
 * Only displayable events with an isoDate and venue produce schema output.
 * Canceled shows emit nothing: their cards are not rendered and structured
 * data must describe user-visible page content.
 */
export function buildEventSchemas(eventsList: EventEntry[]): string[] {
  return eventsList
    .filter(
      (e) => isDisplayable(e) && e.isoDate && e.venue && e.url && e.url !== "#",
    )
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

      const door = addMinutesToTime(start, -30);
      const isPresale = e.onSaleAt
        ? Date.parse(e.onSaleAt) > Date.now()
        : false;
      const availability = e.soldOut
        ? "https://schema.org/SoldOut"
        : isPresale
          ? "https://schema.org/PreSale"
          : "https://schema.org/InStock";

      return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ComedyEvent",
        name: "Garam Masala Dating | Live Comedy Dating Show",
        startDate: `${e.isoDate}T${start}:00${nyOffset(e.isoDate!, start)}`,
        endDate: `${e.isoDate}T${end}:00${nyOffset(e.isoDate!, end)}`,
        doorTime: `${e.isoDate}T${door}:00${nyOffset(e.isoDate!, door)}`,
        eventStatus: e.previousDate
          ? "https://schema.org/EventRescheduled"
          : "https://schema.org/EventScheduled",
        ...(e.previousDate ? { previousStartDate: e.previousDate } : {}),
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
          // Points at our own landing page, not the vendor checkout: Google's
          // structured-data spec only requires offers.url to "clearly and
          // predominantly provide the opportunity to buy a ticket," which our
          // page does. Landing here first (instead of deep-linking straight to
          // Eventbrite/the venue) is also where InitiateCheckout tracking and
          // ad-trust content live, see /api/go/[slug].
          url: `${BASE}/events/${e.slug}`,
          price: e.price ?? "15",
          priceCurrency: "USD",
          availability,
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
