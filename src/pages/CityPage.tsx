import { useParams, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getCityBySlug } from "@/data/cities";

function buildCityJsonLd(city: ReturnType<typeof getCityBySlug>): string {
  if (!city) return "";

  const localBusiness = {
    "@type": "LocalBusiness" as const,
    name: "Garam Masala Dating",
    url: "https://garammasaladating.com",
    areaServed: city.areaServed,
  };

  if (!city.includeEventSchema) {
    return JSON.stringify({
      "@context": "https://schema.org",
      ...localBusiness,
    });
  }

  const event: Record<string, unknown> = {
    "@type": "Event",
    name: `Garam Masala Dating \u2013 ${city.displayName}`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    organizer: {
      "@type": "Organization",
      name: "Garam Masala Dating",
      url: "https://garammasaladating.com",
    },
    location: {
      "@type": "Place",
      name: city.venueName ?? city.displayName,
      address: {
        "@type": "PostalAddress",
        addressLocality: city.addressLocality,
        addressRegion: city.addressRegion,
        addressCountry: "US",
      },
    },
  };

  if (city.eventScheduleFrequency) {
    event.eventSchedule = {
      "@type": "Schedule",
      repeatFrequency: city.eventScheduleFrequency,
    };
  }

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [localBusiness, event],
  });
}

function CityNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🌶️</p>
        <h1
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-ivory)",
            marginBottom: "12px",
          }}
        >
          City not found
        </h1>
        <Link
          to="/cities"
          style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 500, textDecoration: "none" }}
        >
          ← View all cities
        </Link>
      </div>
    </div>
  );
}

export default function CityPage() {
  const { city: citySlug } = useParams<{ city: string }>();
  const city = getCityBySlug(citySlug ?? "");

  const jsonLd = city ? buildCityJsonLd(city) : "";
  const title = city?.titleTag ?? "City Not Found | Garam Masala Dating";
  const description = city?.metaDescription ?? "";

  usePageMeta(title, description, jsonLd || undefined);

  if (!city) return <CityNotFound />;

  return (
    <>
      <style>{`
        @keyframes cityFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          animation: "cityFadeIn 0.5s ease-out both",
        }}
      >
        <div
          style={{
            maxWidth: "680px",
            margin: "0 auto",
            padding: "48px 24px 80px",
          }}
        >
          {/* Eyebrow label */}
          <p
            style={{
              fontFamily: "var(--font-jetbrains)",
              fontSize: "11px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#C9A84C",
              marginBottom: "16px",
            }}
          >
            {city.displayName}
          </p>

          {/* H1 */}
          <h1
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 700,
              color: "var(--text-ivory)",
              lineHeight: 1.12,
              marginBottom: "32px",
            }}
          >
            {city.h1}
          </h1>

          {/* Divider */}
          <div
            style={{
              width: "48px",
              height: "1px",
              background: "rgba(201, 168, 76, 0.3)",
              marginBottom: "36px",
            }}
          />

          {/* Body */}
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {city.bodyParagraphs.map((para, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "18px",
                  color: "rgba(245, 237, 228, 0.78)",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {para}
              </p>
            ))}
          </div>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "44px",
            }}
          >
            {city.ctas.map((cta, i) => (
              <Link
                key={i}
                to={cta.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 22px",
                  borderRadius: "14px",
                  border: "1px solid",
                  borderColor:
                    i === 0
                      ? "rgba(201, 168, 76, 0.5)"
                      : "rgba(245, 237, 228, 0.12)",
                  background:
                    i === 0
                      ? "rgba(201, 168, 76, 0.1)"
                      : "rgba(255, 255, 255, 0.03)",
                  color: i === 0 ? "#E2C97E" : "rgba(245, 237, 228, 0.7)",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "15px",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <span>{cta.label}</span>
                <ArrowRight size={16} style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: "64px",
              paddingTop: "24px",
              borderTop: "1px solid rgba(245, 237, 228, 0.06)",
            }}
          >
            <Link
              to="/cities"
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                color: "rgba(245, 237, 228, 0.35)",
                textDecoration: "none",
              }}
            >
              ← All cities
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
