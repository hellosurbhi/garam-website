import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Instagram,
  Music2,
  Youtube,
  Ticket,
  Mail,
  type LucideIcon,
} from "lucide-react";

/* ─── Link data ─────────────────────────────────────────────── */

interface LinkItem {
  label: string;
  href: string;
  to?: string;
  filled: boolean;
  icon: LucideIcon;
  isPrimary?: boolean;
  external?: boolean;
  comingSoon?: boolean;
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
    href: "https://instagram.com/garammasaladating",
    filled: false,
    icon: Instagram,
    external: true,
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@garammasaladating",
    filled: true,
    icon: Music2,
    external: true,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/playlist?list=PLgDtd7hFH7diDNPEPu_6BWMs017q-I-wZ",
    filled: false,
    icon: Youtube,
    external: true,
  },
  {
    label: "Upcoming Shows & Tickets",
    href: "#",
    filled: false,
    icon: Ticket,
    comingSoon: true,
  },
  {
    label: "Press & Collaborations",
    href: "mailto:press@garammasaladating.com",
    filled: true,
    icon: Mail,
  },
];

const SOCIALS = [
  { icon: Instagram, href: "https://instagram.com/garammasaladating", label: "Instagram" },
  { icon: Music2, href: "https://tiktok.com/@garammasaladating", label: "TikTok" },
];

/* ─── LinkButton ─────────────────────────────────────────────── */

function LinkButton({
  label,
  href,
  to,
  icon: Icon,
  isPrimary,
  external,
  comingSoon,
  delay,
}: LinkItem & { delay: number }) {
  const [hovered, setHovered] = useState(false);

  if (comingSoon) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          padding: "17px 22px",
          borderRadius: "14px",
          border: "1px solid rgba(245, 237, 228, 0.1)",
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: "#F5EDE4",
          fontFamily: "var(--font-cormorant)",
          fontSize: "16px",
          fontWeight: 500,
          opacity: 0.6,
          cursor: "default",
          animation: `fadeUp 0.5s ease-out ${delay}s both`,
        }}
      >
        <Icon size={20} style={{ flexShrink: 0, color: "rgba(245, 237, 228, 0.5)" }} />
        <span style={{ flex: 1, textAlign: "center" }}>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-jetbrains)",
            fontSize: "10px",
            fontWeight: 500,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#C9A84C",
            background: "rgba(201, 168, 76, 0.15)",
            padding: "3px 8px",
            borderRadius: "4px",
          }}
        >
          Soon
        </span>
      </div>
    );
  }

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
      target={href !== "#" ? "_blank" : undefined}
      rel={href !== "#" ? "noopener noreferrer" : undefined}
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
            {LINKS.map((link, i) => (
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
    </>
  );
}
