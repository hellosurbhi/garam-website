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
import { events } from "../data/events";
import { isEventPast } from "../utils/eventDate";
import { pressItems } from "../data/press";
import { SOCIAL_URLS } from "../data/socials";
import styles from "./LinksPage.module.css";

/* ─── Custom TikTok icon (Lucide has no brand icon) ────────── */

function TikTokIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M16.6 5.82A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
    </svg>
  );
}

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
  const linkClass = isPrimary ? styles.primaryLink : styles.glassLink;
  const iconClass = isPrimary ? styles.iconPrimary : styles.iconGlass;

  // Primary gets both fadeUp + pulseGlow; glass gets fadeUp only
  const animStyle = isPrimary
    ? { animation: `fadeUp 0.5s ease-out ${delay}s both, pulseGlow 2.5s ease-in-out 1s infinite` }
    : { animation: `fadeUp 0.5s ease-out ${delay}s both` };

  const inner = (
    <>
      <Icon size={20} className={iconClass} />
      <span className={styles.linkLabel}>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={styles.glassLink} style={animStyle}>
        {inner}
      </button>
    );
  }

  if (to) {
    return (
      <Link to={to} className={linkClass} style={animStyle}>
        {inner}
      </Link>
    );
  }

  const attrs = external ? { target: "_blank" as const, rel: "noopener noreferrer" } : {};

  return (
    <a href={href} className={linkClass} style={animStyle} {...attrs}>
      {inner}
    </a>
  );
}

/* ─── SocialIcon ─────────────────────────────────────────────── */

function SocialIcon({ icon: Icon, href, label }: (typeof SOCIALS)[number]) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.socialIcon}
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
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.headerWrap}>
            <Link to="/" className={styles.homeLink}>
              <h1 className={styles.title}>
                Garam Mas<em className={styles.titleAccent}>ala</em> Dating
              </h1>
            </Link>
            <p className={styles.subtitle}>NYC&apos;s hottest live comedy dating show&nbsp;🌶️</p>
            <div className={styles.divider} />
          </div>

          <div className={styles.linkList}>
            {linksWithHandlers.map((link, i) => (
              <LinkButton key={link.label} {...link} delay={0.1 + i * 0.1} />
            ))}
          </div>

          <div className={styles.socialRow}>
            {SOCIALS.map((s) => (
              <SocialIcon key={s.label} {...s} />
            ))}
          </div>

          <p className={styles.footer}>
            Made with love and a lot of spice&nbsp;🌶️
          </p>
        </div>
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Close"
              className={styles.modalClose}
            >
              <X size={20} />
            </button>

            <h2 className={styles.modalTitle}>Upcoming Shows</h2>
            <div className={styles.modalDivider} />

            {upcomingEvents.length === 0 ? (
              <p className={styles.noEvents}>No upcoming shows — stay tuned!</p>
            ) : (
              <div className={styles.eventList}>
                {upcomingEvents.map((event) => {
                  const hasLink = event.url && event.url !== "#";
                  return hasLink ? (
                    <a
                      key={event.date}
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.eventLink}
                    >
                      <span className={styles.eventCity}>{event.city}</span>
                      <div className={styles.eventDateGroup}>
                        <span className={styles.eventDate}>{event.date}</span>
                        <Ticket size={14} className={styles.ticketIcon} />
                      </div>
                    </a>
                  ) : (
                    <div key={event.date} className={styles.eventTba}>
                      <span className={styles.eventCity}>{event.city}</span>
                      <span className={styles.eventDateMuted}>{event.date}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showPressModal && (
        <div className={styles.overlay} onClick={() => setShowPressModal(false)}>
          <div className={styles.modalScrollable} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowPressModal(false)}
              aria-label="Close"
              className={styles.modalClose}
            >
              <X size={20} />
            </button>

            <h2 className={styles.modalTitle}>As Seen In</h2>
            <div className={styles.modalDivider} />

            <div className={styles.eventList}>
              {[...pressItems].reverse().map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.pressItem}
                >
                  <div className={styles.pressContent}>
                    <div className={styles.pressBadgeRow}>
                      <span className={styles.pressBadge}>
                        {item.type === "podcast" ? <Mic size={10} /> : <Newspaper size={10} />}
                        {item.type}
                      </span>
                    </div>
                    <p className={styles.pressSource}>{item.source}</p>
                  </div>
                  <ExternalLink size={14} className={styles.pressExternalIcon} />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
