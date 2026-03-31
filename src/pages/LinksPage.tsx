import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  Heart,
  Instagram,
  Youtube,
  Mic,
  Ticket,
  Mail,
  X,
  ExternalLink,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

/* ─── Custom TikTok icon (Lucide has no brand icon) ────────── */

function TikTokIcon({ size = 24, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
    >
      <path d="M16.6 5.82A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
    </svg>
  );
}
import { events } from "../data/events";
import { isEventPast } from "../utils/eventDate";
import { pressItems } from "../data/press";
import { SOCIAL_URLS } from "../data/socials";

/* ─── Link data ─────────────────────────────────────────────── */

interface LinkItem {
  label: string;
  href: string;
  to?: string;
  filled: boolean;
  icon: LucideIcon | typeof TikTokIcon;
  isPrimary?: boolean;
  external?: boolean;
  onClick?: () => void;
}

const LINKS: LinkItem[] = [
  {
    label: "Apply to Be on the Show",
    to: "/apply",
    href: "",
    filled: true,
    icon: Heart,
    isPrimary: true,
  },
  {
    label: "Instagram",
    href: SOCIAL_URLS.instagram,
    filled: false,
    icon: Instagram,
    external: true,
  },
  {
    label: "TikTok",
    href: SOCIAL_URLS.tiktok,
    filled: true,
    icon: TikTokIcon,
    external: true,
  },
  {
    label: "YouTube",
    href: SOCIAL_URLS.youtube,
    filled: false,
    icon: Youtube,
    external: true,
  },
  {
    label: "As Seen In",
    href: "#",
    filled: false,
    icon: Mic,
  },
  {
    label: "Upcoming Shows & Tickets",
    href: "#",
    filled: false,
    icon: Ticket,
  },
  {
    label: "Booking & Press Inquiries",
    href: SOCIAL_URLS.email,
    filled: true,
    icon: Mail,
  },
];

const SOCIALS = [
  { icon: Instagram, href: SOCIAL_URLS.instagram, label: "Instagram" },
  { icon: TikTokIcon, href: SOCIAL_URLS.tiktok, label: "TikTok" },
  { icon: Youtube, href: SOCIAL_URLS.youtube, label: "YouTube" },
  { icon: Mail, href: SOCIAL_URLS.email, label: "Email" },
];

/* ─── LinkButton ─────────────────────────────────────────────── */

function LinkButton({
  label,
  href,
  to,
  icon: Icon,
  isPrimary,
  external,
  onClick,
  delay,
}: LinkItem & { delay: number }) {
  const [hovered, setHovered] = useState(false);

  const primaryStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "20px 24px",
    borderRadius: "14px",
    border: "none",
    background: "#C9A84C",
    color: "#0D0A08",
    fontFamily: "var(--font-cormorant)",
    fontSize: "17px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textDecoration: "none",
    cursor: "pointer",
    transition: "transform 0.25s ease, box-shadow 0.25s ease",
    transform: hovered ? "scale(1.02)" : "scale(1)",
    boxShadow: hovered
      ? "0 4px 20px rgba(0, 0, 0, 0.3)"
      : "0 2px 12px rgba(201, 168, 76, 0.25)",
    animation: `fadeUp 0.5s ease-out ${delay}s both, pulseGlow 2.5s ease-in-out 1s infinite`,
  };

  const glassStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "17px 22px",
    borderRadius: "14px",
    border: hovered
      ? "1px solid rgba(201, 168, 76, 0.35)"
      : "1px solid rgba(245, 237, 228, 0.1)",
    background: hovered ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "#F5EDE4",
    fontFamily: "var(--font-cormorant)",
    fontSize: "16px",
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
    transition: "all 0.25s ease",
    transform: hovered ? "scale(1.015)" : "scale(1)",
    boxShadow: hovered ? "0 4px 20px rgba(0, 0, 0, 0.3)" : "none",
    animation: `fadeUp 0.5s ease-out ${delay}s both`,
  };

  const baseStyle = isPrimary ? primaryStyle : glassStyle;

  const inner = (
    <>
      <Icon
        size={20}
        style={{
          flexShrink: 0,
          color: isPrimary ? "#0D0A08" : "rgba(245, 237, 228, 0.5)",
        }}
      />
      <span style={{ flex: 1, textAlign: "center" }}>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ ...glassStyle, border: glassStyle.border as string }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {inner}
      </button>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        style={baseStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {inner}
      </Link>
    );
  }

  const attrs = external ? { target: "_blank" as const, rel: "noopener noreferrer" } : {};

  return (
    <a
      href={href}
      style={baseStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...attrs}
    >
      {inner}
    </a>
  );
}

/* ─── SocialIcon ─────────────────────────────────────────────── */

function SocialIcon({ icon: Icon, href, label }: (typeof SOCIALS)[number]) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? "rgba(201, 168, 76, 0.15)" : "rgba(245, 237, 228, 0.08)",
        color: hovered ? "#C9A84C" : "rgba(245, 237, 228, 0.25)",
        transition: "background 0.2s, color 0.2s",
        textDecoration: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon size={18} />
    </a>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function LinksPage() {
  usePageMeta(
    "Tickets, Shows & More | Garam Masala Dating",
    "Get tickets to upcoming Garam Masala Dating shows, follow us on Instagram and TikTok, apply as a contestant, or reach out for booking and press."
  );
  const [showModal, setShowModal] = useState(false);
  const [showPressModal, setShowPressModal] = useState(false);
  const upcomingEvents = events.filter((e) => !isEventPast(e.date) && !e.hidden);

  useEffect(() => {
    if (!showModal && !showPressModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showModal, showPressModal]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowModal(false);
        setShowPressModal(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const linksWithHandlers = LINKS.map((link) => {
    if (link.icon === Ticket) return { ...link, onClick: () => setShowModal(true) };
    if (link.label === "As Seen In") return { ...link, onClick: () => setShowPressModal(true) };
    return link;
  });

  return (
    <>
      <style>{`
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes headerFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 2px 12px rgba(201,168,76,0.25), 0 0 0 0 rgba(201,168,76,0); }
          50%       { box-shadow: 0 2px 12px rgba(201,168,76,0.25), 0 0 0 8px rgba(201,168,76,0.12); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "transparent",
          position: "relative",
          animation: "pageIn 0.3s ease-out both",
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "420px",
            margin: "0 auto",
            padding: "48px 24px 56px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              textAlign: "center",
              animation: "headerFadeUp 0.6s ease-out 0s both",
              marginBottom: "32px",
            }}
          >
            <Link to="/" style={{ textDecoration: "none", cursor: "pointer" }}>
              <h1
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "36px",
                  fontWeight: 700,
                  color: "#F5EDE4",
                  lineHeight: 1.15,
                  marginBottom: "10px",
                }}
              >
                Garam Mas<em style={{ fontStyle: "italic", color: "#E2C97E" }}>ala</em> Dating
              </h1>
            </Link>
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "17px",
                color: "rgba(245, 237, 228, 0.55)",
                lineHeight: 1.5,
              }}
            >
              NYC&apos;s hottest live comedy dating show&nbsp;🌶️
            </p>
            <div
              style={{
                width: "48px",
                height: "1px",
                background: "rgba(201, 168, 76, 0.3)",
                margin: "18px auto 0",
              }}
            />
          </div>

          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {linksWithHandlers.map((link, i) => (
              <LinkButton key={link.label} {...link} delay={0.1 + i * 0.1} />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "36px",
              animation: "headerFadeUp 0.5s ease-out 0.9s both",
            }}
          >
            {SOCIALS.map((s) => (
              <SocialIcon key={s.label} {...s} />
            ))}
          </div>

          <p
            style={{
              marginTop: "32px",
              fontSize: "14px",
              fontFamily: "var(--font-cormorant)",
              fontStyle: "italic",
              color: "rgba(245, 237, 228, 0.2)",
              textAlign: "center",
              animation: "headerFadeUp 0.5s ease-out 1s both",
            }}
          >
            Made with love and a lot of spice&nbsp;🌶️
          </p>
        </div>
      </div>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "overlayIn 0.2s ease-out both",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "400px",
              background: "rgba(20, 16, 13, 0.95)",
              border: "1px solid rgba(201, 168, 76, 0.2)",
              borderRadius: "20px",
              padding: "32px 24px",
              animation: "modalIn 0.25s ease-out both",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "rgba(245, 237, 228, 0.4)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#F5EDE4")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245, 237, 228, 0.4)")}
            >
              <X size={20} />
            </button>

            <h2
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "22px",
                fontWeight: 600,
                color: "#F5EDE4",
                marginBottom: "8px",
              }}
            >
              Upcoming Shows
            </h2>
            <div
              style={{
                width: "32px",
                height: "1px",
                background: "rgba(201, 168, 76, 0.3)",
                marginBottom: "24px",
              }}
            />

            {upcomingEvents.length === 0 ? (
              <p
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "16px",
                  color: "rgba(245, 237, 228, 0.5)",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                No upcoming shows — stay tuned!
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {upcomingEvents.map((event) => {
                  const hasLink = event.url && event.url !== "#";
                  return hasLink ? (
                    <a
                      key={event.date}
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        borderRadius: "12px",
                        border: "1px solid rgba(201, 168, 76, 0.15)",
                        background: "rgba(255, 255, 255, 0.04)",
                        textDecoration: "none",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(201, 168, 76, 0.1)";
                        e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.35)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                        e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.15)";
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-cormorant)",
                          fontSize: "16px",
                          fontWeight: 500,
                          color: "#F5EDE4",
                        }}
                      >
                        {event.city}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-dm-sans)",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "rgba(245, 237, 228, 0.6)",
                          }}
                        >
                          {event.date}
                        </span>
                        <Ticket size={14} style={{ color: "#C9A84C" }} />
                      </div>
                    </a>
                  ) : (
                    <div
                      key={event.date}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        borderRadius: "12px",
                        border: "1px solid rgba(245, 237, 228, 0.06)",
                        background: "rgba(255, 255, 255, 0.02)",
                        opacity: 0.5,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-cormorant)",
                          fontSize: "16px",
                          fontWeight: 500,
                          color: "#F5EDE4",
                        }}
                      >
                        {event.city}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "rgba(245, 237, 228, 0.4)",
                        }}
                      >
                        {event.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showPressModal && (
        <div
          onClick={() => setShowPressModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "overlayIn 0.2s ease-out both",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "400px",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "rgba(20, 16, 13, 0.95)",
              border: "1px solid rgba(201, 168, 76, 0.2)",
              borderRadius: "20px",
              padding: "32px 24px",
              animation: "modalIn 0.25s ease-out both",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowPressModal(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "rgba(245, 237, 228, 0.4)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#F5EDE4")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245, 237, 228, 0.4)")}
            >
              <X size={20} />
            </button>

            <h2
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "22px",
                fontWeight: 600,
                color: "#F5EDE4",
                marginBottom: "8px",
              }}
            >
              As Seen In
            </h2>
            <div
              style={{
                width: "32px",
                height: "1px",
                background: "rgba(201, 168, 76, 0.3)",
                marginBottom: "24px",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[...pressItems].reverse().map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(201, 168, 76, 0.15)",
                    background: "rgba(255, 255, 255, 0.04)",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                    gap: "12px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(201, 168, 76, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                    e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.15)";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: "rgba(201, 168, 76, 0.12)",
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#C9A84C",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {item.type === "podcast" ? <Mic size={10} /> : <Newspaper size={10} />}
                        {item.type}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-cormorant)",
                        fontSize: "16px",
                        fontWeight: 500,
                        color: "#F5EDE4",
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.source}
                    </p>
                  </div>
                  <ExternalLink
                    size={14}
                    style={{ flexShrink: 0, color: "#C9A84C" }}
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
