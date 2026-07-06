import { useMemo, useEffect, useRef } from "react";
import { events } from "@/data/events";
import { SOCIAL_URLS } from "@/data/socials";
import { buildTicketUrl } from "@/utils/eventUrl";
import { formatEventLocation } from "@/utils/eventCity";
import { buildLeadAttribution } from "@/lib/leadAttribution";
import { capture } from "@/lib/analyticsCapture";
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
        !e.hidden && !e.soldOut && e.isoDate && e.isoDate >= today && e.url,
    );
  }, []);

  const showsWithWidget = useMemo(
    () => upcomingShows.filter((e) => e.eventbriteId),
    [upcomingShows],
  );
  const upcomingShowLabels = useMemo(
    () =>
      upcomingShows.map((show) => ({
        show,
        cityLabel: formatEventLocation(show),
      })),
    [upcomingShows],
  );

  useEffect(() => {
    if (showsWithWidget.length === 0) return;
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return;

    let orderCompleted = false;
    let modalOpenedAt = 0;

    function initWidgets() {
      const rootStyle = getComputedStyle(document.documentElement);
      const brandColor =
        rootStyle.getPropertyValue("--brand-red").trim() || "#DC2626";
      const fontColor =
        rootStyle.getPropertyValue("--charcoal").trim() || "#1A1A1A";
      const bgColor = rootStyle.getPropertyValue("--white").trim() || "#FFFFFF";
      for (const show of showsWithWidget) {
        const cityLabel = formatEventLocation(show);
        const tid = `eventbrite-widget-modal-trigger-success-${show.eventbriteId}`;
        const btn = document.getElementById(tid);
        btn?.addEventListener("click", () => {
          sessionStorage.setItem(
            "eb_cta_source",
            JSON.stringify({
              event_id: show.eventbriteId ?? "",
              section: "apply_success",
              page: window.location.pathname,
              city: cityLabel,
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
            async onOrderComplete() {
              orderCompleted = true;
              const raw = sessionStorage.getItem("eb_cta_source");
              const src: Record<string, string> | null = raw
                ? JSON.parse(raw)
                : null;
              sessionStorage.removeItem("eb_cta_source");
              const attr = await buildLeadAttribution({
                source: "ticket_purchase",
              });
              capture("order_complete", {
                event_id: show.eventbriteId,
                city: cityLabel,
                source_section: src?.section ?? "apply_success",
                source_page: src?.page ?? "/apply",
                price: src?.price ?? show.price ?? "",
                landing_page: attr.landingPage,
                referrer_host: attr.referrerHost,
                utm_source: attr.utmSource,
                utm_campaign: attr.utmCampaign,
                utm_medium: attr.utmMedium,
                utm_content: attr.utmContent,
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
                      item_name: `Garam Masala Dating - ${cityLabel}`,
                      item_id: String(show.eventbriteId),
                      price,
                      quantity: 1,
                    },
                  ],
                },
                source_section: "apply_success",
                source_page: src?.page ?? "/apply",
                landing_page: attr.landingPage,
                referrer_host: attr.referrerHost,
                utm_source: attr.utmSource,
                utm_campaign: attr.utmCampaign,
              });
              window.fbq?.("track", "Purchase", {
                value: price,
                currency: "USD",
                content_ids: [String(show.eventbriteId)],
              });
            },
          });
          // Prevent native click behavior once widget is bound
          btn?.addEventListener("click", (e) => e.preventDefault());
        } catch {
          // Widget init failed; button stays inert (no navigation needed)
          capture("widget_load_failed", {
            event_id: show.eventbriteId ?? "",
            city: cityLabel,
            page: window.location.pathname,
          });
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

    // Track modal open/close for checkout funnel visibility.
    // Set up at useEffect level so the cleanup can be returned directly.
    const modalObserver = new MutationObserver(() => {
      const ebStructure = document.querySelector<HTMLElement>(
        "div.eds-structure_main",
      );
      if (!ebStructure || ebStructure.dataset.listenerAttached) return;
      ebStructure.dataset.listenerAttached = "1";

      orderCompleted = false;
      modalOpenedAt = Date.now();
      const openRaw = sessionStorage.getItem("eb_cta_source");
      const openData = openRaw
        ? (JSON.parse(openRaw) as Record<string, string>)
        : null;
      capture("checkout_opened", {
        event_id: openData?.event_id ?? "",
        city: openData?.city ?? "",
        source_section: openData?.section ?? "",
        source_page: openData?.page ?? window.location.pathname,
        price: openData?.price ?? "",
      });

      const closeObserver = new MutationObserver(() => {
        if (!document.querySelector("div.eds-structure_main")) {
          closeObserver.disconnect();
          if (!orderCompleted) {
            const durationMs = modalOpenedAt ? Date.now() - modalOpenedAt : 0;
            const closeRaw = sessionStorage.getItem("eb_cta_source");
            const closeData = closeRaw
              ? (JSON.parse(closeRaw) as Record<string, string>)
              : null;
            capture("checkout_abandoned", {
              event_id: closeData?.event_id ?? "",
              city: closeData?.city ?? "",
              source_section: closeData?.section ?? "",
              source_page: closeData?.page ?? window.location.pathname,
              price: closeData?.price ?? "",
              duration_seconds: Math.round(durationMs / 1000),
            });
          }
        }
      });
      closeObserver.observe(document.body, { childList: true, subtree: false });

      clearTimeout(modalObserverTimeout);
      modalObserver.disconnect();
    });
    const modalObserverTimeout = setTimeout(
      () => modalObserver.disconnect(),
      30_000,
    );
    modalObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(modalObserverTimeout);
      modalObserver.disconnect();
    };
  }, [showsWithWidget]);

  return (
    <div className={styles.successPanel} role="status" aria-live="polite">
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
              const tid = show.eventbriteId
                ? `eventbrite-widget-modal-trigger-success-${show.eventbriteId}`
                : null;
              return (
                <li key={`${show.isoDate}-${cityLabel}`}>
                  {tid ? (
                    <button
                      type="button"
                      id={tid}
                      data-eb-event-id={show.eventbriteId}
                      className={styles.successTicketButton}
                    >
                      Get Tickets | {show.date} in {cityLabel}
                    </button>
                  ) : (
                    <a
                      href={buildTicketUrl(show.url, "apply", "success")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.successTicketButton}
                    >
                      Get Tickets | {show.date} in {cityLabel}
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
