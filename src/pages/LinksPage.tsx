import { useState } from "react";
import { Link } from "react-router-dom";
import { SubpageBackground } from "@/components/SubpageBackground/SubpageBackground";
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
    href: "#",
    filled: false,
    icon: Youtube,
    comingSoon: true,
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
  filled,
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
          border: "2px solid var(--border)",
          background: "var(--cream)",
          color: "var(--text-light)",
          fontFamily: "var(--font-dm-sans)",
          fontSize: "15px",
          fontWeight: 600,
          letterSpacing: "0.01em",
          opacity: 0.55,
          cursor: "default",
          animation: `fadeUp 0.5s ease-out ${delay}s both`,
        }}
      >
        <Icon size={20} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "center" }}>{label}</span>
        <span style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Soon
        </span>
      </div>
    );
  }

  const baseStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: isPrimary ? "20px 24px" : "17px 22px",
    borderRadius: "14px",
    border: `2px solid var(--crimson)`,
    background: filled ? "var(--crimson)" : "var(--cream)",
    color: filled ? "#fff" : "var(--crimson)",
    fontFamily: "var(--font-dm-sans)",
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "0.01em",
    textDecoration: "none",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    transform: hovered ? "scale(1.02)" : "scale(1)",
    boxShadow: hovered
      ? `0 6px 24px rgba(196,30,58,${filled ? "0.22" : "0.12"})`
      : isPrimary
      ? "0 2px 12px rgba(196,30,58,0.15)"
      : "none",
    animation: isPrimary
      ? `fadeUp 0.5s ease-out ${delay}s both, pulseGlow 2.5s ease-in-out 1s infinite`
      : `fadeUp 0.5s ease-out ${delay}s both`,
  };

  const inner = (
    <>
      <Icon size={20} style={{ flexShrink: 0 }} />
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
        background: hovered ? "rgba(196,30,58,0.1)" : "rgba(122,111,102,0.1)",
        color: hovered ? "var(--crimson)" : "var(--text-light)",
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
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes headerFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 2px 12px rgba(196,30,58,0.15), 0 0 0 0 rgba(196,30,58,0); }
          50%       { box-shadow: 0 2px 12px rgba(196,30,58,0.15), 0 0 0 8px rgba(196,30,58,0.14); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "transparent",
          position: "relative",
        }}
      >
        <SubpageBackground />

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
                color: "var(--crimson)",
                lineHeight: 1.15,
                marginBottom: "10px",
              }}
            >
              Garam Masala Dating
            </h1>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "15px",
                color: "var(--text-light)",
                lineHeight: 1.5,
              }}
            >
              NYC&apos;s hottest live comedy dating show&nbsp;🌶️
            </p>
            <div
              style={{
                width: "48px",
                height: "2px",
                background: "var(--gold)",
                borderRadius: "2px",
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
              fontSize: "13px",
              color: "var(--text-light)",
              fontStyle: "italic",
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
