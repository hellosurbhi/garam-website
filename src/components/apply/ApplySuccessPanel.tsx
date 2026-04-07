import { useMemo } from "react";
import { events } from "@/data/events";
import { SOCIAL_URLS } from "@/data/socials";
import styles from "@/components/ApplyPage.module.css";

export function ApplySuccessPanel() {
  const nextShow = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return (
      events.find((e) => !e.hidden && e.isoDate && e.isoDate >= today) ?? null
    );
  }, []);

  return (
    <div className={styles.successPanel} role="status" aria-live="polite">
      <div className={styles.successEmoji}>🌶️</div>
      <h1 className={styles.successTitle}>Thanks for applying!</h1>
      <p className={styles.successText}>
        We review every application and will reach out if you&apos;re selected.
      </p>

      <div className={styles.successCard}>
        <h3 className={styles.successCardTitle}>Want to boost your chances?</h3>
        <p className={styles.successCardText}>
          Follow{" "}
          <a
            href={SOCIAL_URLS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.successLink}
          >
            @garammasaladating
          </a>{" "}
          on Instagram. We tend to pick contestants who are already part of the
          community.
        </p>
      </div>

      <div className={styles.successCard}>
        <h3 className={styles.successCardTitle}>Come steal the show</h3>
        <p className={styles.successCardText}>
          Most of our contestants started as audience members. Come to a show,
          be a Stealer, and show us what you&apos;ve got. It seriously increases
          your odds.
        </p>
        <p className={styles.successCoupon}>
          Use code <strong>STEALER</strong> for 20% off your next ticket.
        </p>
        {nextShow && (
          <a
            href={nextShow.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.successTicketButton}
          >
            Get Tickets | {nextShow.date} in {nextShow.city}
          </a>
        )}
      </div>
    </div>
  );
}
