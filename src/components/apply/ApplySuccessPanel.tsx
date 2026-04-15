import { useMemo, useEffect } from "react";
import { events } from "@/data/events";
import { SOCIAL_URLS } from "@/data/socials";
import styles from "@/components/ApplyPage.module.css";

interface EBWidgetConfig {
  widgetType: string;
  eventId: string;
  modal: boolean;
  modalTriggerElementId: string;
  themeSettings?: Record<string, string>;
  promoCode?: string;
  onOrderComplete?: () => void;
}

declare global {
  interface Window {
    EBWidgets?: { createWidget: (config: EBWidgetConfig) => void };
  }
}

export function ApplySuccessPanel() {
  const nextShow = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return (
      events.find((e) => !e.hidden && e.isoDate && e.isoDate >= today) ?? null
    );
  }, []);

  const triggerId = nextShow?.eventbriteId
    ? `eventbrite-widget-modal-trigger-success-${nextShow.eventbriteId}`
    : null;

  useEffect(() => {
    if (!triggerId || !nextShow?.eventbriteId) return;

    function initWidget() {
      const rootStyle = getComputedStyle(document.documentElement);
      const brandColor =
        rootStyle.getPropertyValue("--brand-red").trim() || "#DC2626";
      const fontColor =
        rootStyle.getPropertyValue("--charcoal").trim() || "#1A1A1A";
      const bgColor = rootStyle.getPropertyValue("--white").trim() || "#FFFFFF";
      try {
        window.EBWidgets?.createWidget({
          widgetType: "checkout",
          eventId: nextShow!.eventbriteId!,
          modal: true,
          modalTriggerElementId: triggerId!,
          promoCode: "STEALER",
          themeSettings: { brandColor, fontColor, background: bgColor },
        });
        // Prevent native click behavior once widget is bound
        document
          .getElementById(triggerId!)
          ?.addEventListener("click", (e) => e.preventDefault());
      } catch {
        // Widget init failed; button stays inert (no navigation needed)
      }
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="eb_widgets"]',
    );
    if (existingScript) {
      // Script already in DOM — may or may not have fired onload yet
      if (window.EBWidgets) {
        initWidget();
      } else {
        existingScript.addEventListener("load", initWidget, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://www.eventbrite.com/static/widgets/eb_widgets.js";
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    }
  }, [triggerId, nextShow]);

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
        {nextShow && triggerId ? (
          <button
            id={triggerId}
            data-eb-event-id={nextShow.eventbriteId}
            data-promo-code="STEALER"
            className={styles.successTicketButton}
          >
            Get Tickets | {nextShow.date} in {nextShow.city}
          </button>
        ) : nextShow ? (
          <a
            href={nextShow.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.successTicketButton}
          >
            Get Tickets | {nextShow.date} in {nextShow.city}
          </a>
        ) : null}
      </div>
    </div>
  );
}
