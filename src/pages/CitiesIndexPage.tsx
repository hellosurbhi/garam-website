import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { citiesIndex } from "@/data/cities";

const TITLE = "Cities | Garam Masala Dating";
const DESC =
  "Find Garam Masala Dating near you \u2014 live comedy dating shows and South Asian singles mixers in cities across the US.";

export default function CitiesIndexPage() {
  usePageMeta(TITLE, DESC);

  return (
    <>
      <style>{`
        @keyframes citiesIdxFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          animation: "citiesIdxFadeIn 0.5s ease-out both",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "48px 24px 80px",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "40px" }}>
            <p
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "11px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#C9A84C",
                marginBottom: "12px",
              }}
            >
              Cities
            </p>
            <h1
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "32px",
                fontWeight: 700,
                color: "var(--text-ivory)",
                lineHeight: 1.15,
                marginBottom: "14px",
              }}
            >
              Where We Show Up
            </h1>
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "17px",
                color: "rgba(245, 237, 228, 0.6)",
                lineHeight: 1.55,
              }}
            >
              Live comedy dating shows and South Asian singles mixers across the US.
            </p>
          </div>

          {/* Divider */}
          <div
            style={{
              width: "48px",
              height: "1px",
              background: "rgba(201, 168, 76, 0.3)",
              marginBottom: "32px",
            }}
          />

          {/* City cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {citiesIndex.map((city, i) => (
              <Link
                key={city.slug}
                to={`/cities/${city.slug}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "22px 22px",
                  borderRadius: "14px",
                  border: "1px solid",
                  borderColor:
                    city.status === "active"
                      ? "rgba(201, 168, 76, 0.35)"
                      : "rgba(245, 237, 228, 0.08)",
                  background:
                    city.status === "active"
                      ? "rgba(201, 168, 76, 0.06)"
                      : "rgba(255, 255, 255, 0.02)",
                  textDecoration: "none",
                  animation: `citiesIdxFadeIn 0.5s ease-out ${0.1 + i * 0.06}s both`,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontFamily: "var(--font-playfair)",
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "var(--text-ivory)",
                      lineHeight: 1.25,
                      marginBottom: "6px",
                    }}
                  >
                    {city.displayName}
                  </h2>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains)",
                      fontSize: "10px",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color:
                        city.status === "active"
                          ? "#C9A84C"
                          : "rgba(245, 237, 228, 0.4)",
                    }}
                  >
                    {city.badgeLabel}
                  </span>
                </div>
                <ArrowRight
                  size={16}
                  style={{
                    flexShrink: 0,
                    color:
                      city.status === "active"
                        ? "#C9A84C"
                        : "rgba(245, 237, 228, 0.3)",
                  }}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
