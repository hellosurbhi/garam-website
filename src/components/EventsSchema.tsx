import { useEffect } from "react";
import { events } from "@/data/events";

const BASE = "https://garammasaladating.com";

function buildEventsJsonLd(): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(
    (e) => !e.hidden && e.isoDate && e.isoDate >= today,
  );
  if (upcoming.length === 0) return null;

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: upcoming.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Event",
        name: `Garam Masala Dating — ${e.city}`,
        description:
          "A live comedy dating show and South Asian singles mixer. Real blind dates on stage, followed by a mixer.",
        startDate: `${e.isoDate}T20:00:00-04:00`,
        endDate: `${e.isoDate}T22:00:00-04:00`,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode:
          "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: e.city,
          address: {
            "@type": "PostalAddress",
            addressLocality: e.city.split(",")[0].trim(),
            addressRegion: e.city.includes(",")
              ? e.city.split(",")[1].trim()
              : undefined,
            addressCountry: "US",
          },
        },
        organizer: {
          "@type": "Organization",
          name: "Garam Masala Dating",
          url: BASE,
        },
        offers: {
          "@type": "Offer",
          url: e.url,
          availability: "https://schema.org/InStock",
        },
        image: `${BASE}/og-image.jpg`,
      },
    })),
  });
}

export function EventsSchema() {
  useEffect(() => {
    const jsonLd = buildEventsJsonLd();
    if (!jsonLd) return;

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = jsonLd;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return null;
}
