import { useMemo, useEffect, useRef } from "react";
import { events, isDisplayable } from "@/data/events";
import { SOCIAL_URLS } from "@/data/socials";
import { formatEventLocation } from "@/utils/eventCity";
import { wireTicketCtaTracking } from "@/lib/ticketCtaTracking";
import { vendorFromUrl } from "@/lib/analyticsCapture";
import styles from "@/components/ApplyPage.module.css";

export function ApplySuccessPanel() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const upcomingShows = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return events.filter(
      (e) =>
        isDisplayable(e) &&
        !e.soldOut &&
        e.isoDate &&
        e.isoDate >= today &&
        e.url,
    );
  }, []);

  const upcomingShowLabels = useMemo(
    () =>
      upcomingShows.map((show) => ({
        show,
        cityLabel: formatEventLocation(show),
      })),
    [upcomingShows],
  );

  // Wires the "Get Tickets" links below with the same tracked-redirect click
  // handler every other ticket CTA on the site uses (src/lib/ticketCtaTracking.ts
  // -> /api/go/[slug].ts). This replaces the Eventbrite checkout-modal widget
  // (EBWidgets.createWidget) that used to live in this component: it duplicated
  // the shared click/tracking logic and was the only place still firing
  // `fbq('track', 'Purchase')` directly off a client-reported, unverified price
  // instead of the CAPI-deduped, real-order-value Purchase pipeline in
  // src/pages/api/sync-orders.ts (the authoritative source now).
  useEffect(() => {
    if (upcomingShows.length === 0) return;
    wireTicketCtaTracking();
  }, [upcomingShows]);

  return (
    <div
      className={styles.successPanel}
      role="status"
      aria-live="polite"
      data-testid="apply-success"
    >
      <div className={styles.successEmoji}>🌶️</div>
      <h1 ref={headingRef} tabIndex={-1} className={styles.successTitle}>
        Thanks for applying!
      </h1>
      <p className={styles.successText}>
        We review every application and will reach out if you&apos;re selected.
      </p>

      <div className={styles.successCard}>
        <h3 className={styles.successCardTitle}>Want to boost your chances?</h3>
        <p className={styles.successCardText}>
          Follow and DM{" "}
          <a
            href={SOCIAL_URLS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.successLink}
          >
            @garammasaladating
          </a>{" "}
          on Instagram. Reaching out directly puts a real face to your
          application.
        </p>
      </div>

      {upcomingShows.length > 0 && (
        <div className={styles.successCard}>
          <h3 className={styles.successCardTitle}>Come steal the show</h3>
          <p className={styles.successCardText}>
            Most of our contestants started as audience members. Come to a show,
            be a Stealer, and show us what you&apos;ve got. It seriously
            increases your odds.
          </p>
          <p className={styles.successCoupon}>
            Use code <strong>STEALER</strong> for 20% off your next ticket. Only
            valid for Garam Masala produced events.
          </p>
          <ul className={styles.successShowList}>
            {upcomingShowLabels.map(({ show, cityLabel }) => {
              const eventTitle = `Garam Masala Dating - ${cityLabel} - ${show.date}`;
              return (
                <li key={`${show.isoDate}-${cityLabel}`}>
                  <a
                    href={`/api/go/${show.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.successTicketButton}
                    data-go-ticket
                    data-event-slug={show.slug}
                    data-event-vendor={vendorFromUrl(show.url)}
                    data-cta-position="apply_success"
                    data-cta-text={`Get Tickets: ${show.date} in ${cityLabel}`}
                    data-event-city={cityLabel}
                    data-event-date={show.isoDate ?? show.date}
                    data-event-title={eventTitle}
                  >
                    Get Tickets: {show.date} in {cityLabel}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
