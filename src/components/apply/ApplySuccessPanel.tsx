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
  onOrderComplete?: () => void;
}

declare global {
  interface Window {
    EBWidgets?: { createWidget: (config: EBWidgetConfig) => void };
    dataLayer?: Record<string, unknown>[];
  }
}

export function ApplySuccessPanel() {
  const upcomingShows = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return events.filter(
      (e) =>
        !e.hidden && !e.soldOut && e.isoDate && e.isoDate >= today && e.url,
    );
  }, []);

  const showsWithWidget = useMemo(
    () => upcomingShows.filter((e) => e.eventbriteId),
    [upcomingShows],
  );

  useEffect(() => {
    if (showsWithWidget.length === 0) return;

    function initWidgets() {
      const rootStyle = getComputedStyle(document.documentElement);
      const brandColor =
        rootStyle.getPropertyValue("--brand-red").trim() || "#DC2626";
      const fontColor =
        rootStyle.getPropertyValue("--charcoal").trim() || "#1A1A1A";
      const bgColor = rootStyle.getPropertyValue("--white").trim() || "#FFFFFF";
      for (const show of showsWithWidget) {
        const tid = `eventbrite-widget-modal-trigger-success-${show.eventbriteId}`;
        const btn = document.getElementById(tid);
        btn?.addEventListener("click", () => {
          sessionStorage.setItem(
            "eb_cta_source",
            JSON.stringify({
              section: "apply_success",
              page: window.location.pathname,
              city: show.city,
              price: show.price ?? "",
              event_date: show.date,
            }),
          );
        });
        try {
          window.EBWidgets?.createWidget({
            widgetType: "checkout",
            eventId: show.eventbriteId!,
            modal: true,
            modalTriggerElementId: tid,
            themeSettings: { brandColor, fontColor, background: bgColor },
            onOrderComplete() {
              const raw = sessionStorage.getItem("eb_cta_source");
              const src: Record<string, string> | null = raw
                ? JSON.parse(raw)
                : null;
              sessionStorage.removeItem("eb_cta_source");
              window.posthog?.capture?.("order_complete", {
                event_id: show.eventbriteId,
                city: show.city,
                source_section: src?.section ?? "apply_success",
                source_page: src?.page ?? "/apply",
                price: src?.price ?? show.price ?? "",
              });
              const price = parseFloat(
                (src?.price ?? show.price ?? "").replace(/[^0-9.]/g, "") || "0",
              );
              window.dataLayer = window.dataLayer ?? [];
              window.dataLayer.push({ ecommerce: null });
              window.dataLayer.push({
                event: "purchase",
                ecommerce: {
                  currency: "USD",
                  value: price,
                  items: [
                    {
                      item_name: `Garam Masala Dating - ${show.city}`,
                      item_id: String(show.eventbriteId),
                      price,
                      quantity: 1,
                    },
                  ],
                },
                source_section: "apply_success",
                source_page: src?.page ?? "/apply",
              });
            },
          });
          // Prevent native click behavior once widget is bound
          btn?.addEventListener("click", (e) => e.preventDefault());
        } catch {
          // Widget init failed; button stays inert (no navigation needed)
        }
      }
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="eb_widgets"]',
    );
    if (existingScript) {
      // Script already in DOM — may or may not have fired onload yet
      if (window.EBWidgets) {
        initWidgets();
      } else {
        existingScript.addEventListener("load", initWidgets, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://www.eventbrite.com/static/widgets/eb_widgets.js";
      script.async = true;
      script.onload = initWidgets;
      document.head.appendChild(script);
    }
  }, [showsWithWidget]);

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

      {upcomingShows.length > 0 && (
        <div className={styles.successCard}>
          <h3 className={styles.successCardTitle}>Come steal the show</h3>
          <p className={styles.successCardText}>
            Most of our contestants started as audience members. Come to a show,
            be a Stealer, and show us what you&apos;ve got. It seriously
            increases your odds.
          </p>
          <p className={styles.successCoupon}>
            Use code <strong>STEALER</strong> for 20% off your next ticket.
          </p>
          <ul className={styles.successShowList}>
            {upcomingShows.map((show) => {
              const tid = show.eventbriteId
                ? `eventbrite-widget-modal-trigger-success-${show.eventbriteId}`
                : null;
              return (
                <li key={`${show.isoDate}-${show.city}`}>
                  {tid ? (
                    <button
                      type="button"
                      id={tid}
                      data-eb-event-id={show.eventbriteId}
                      className={styles.successTicketButton}
                    >
                      Get Tickets | {show.date} in {show.city}
                    </button>
                  ) : (
                    <a
                      href={show.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.successTicketButton}
                    >
                      Get Tickets | {show.date} in {show.city}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
