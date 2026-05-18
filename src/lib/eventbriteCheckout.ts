import { buildLeadAttribution } from "@/lib/leadAttribution";

interface EBWidgetConfig {
  widgetType: string;
  eventId: string;
  modal: boolean;
  modalTriggerElementId: string;
  themeSettings?: Record<string, string>;
  onOrderComplete?: () => void;
  onWidgetModalClose?: () => void;
}

interface EventbriteTriggerConfig {
  eventId: string;
  triggerId: string;
  fallbackUrl: string;
  city: string;
  section: string;
  price: string;
  eventDate: string;
}

export interface EventbriteCheckoutOptions {
  selector?: string;
  defaultSection?: string;
  autoOpenQueryParam?: string;
  cleanAutoOpenQuery?: boolean;
}

const EVENTBRITE_WIDGET_SRC =
  "https://www.eventbrite.com/static/widgets/eb_widgets.js";
const EVENTBRITE_OVERLAY_ID = "eventbrite-widget-modal-overlay";
const EVENTBRITE_IFRAME_SELECTOR =
  'iframe[id^="eventbrite-widget-modal-"], iframe[src*="checkout-external"][src*="eventbrite"]';
const OUTSIDE_CLOSE_ID = "gmd-eventbrite-outside-close";
const AUTO_OPEN_INITIAL_DELAY_MS = 150;
const AUTO_OPEN_RETRY_DELAY_MS = 750;
const AUTO_OPEN_MAX_ATTEMPTS = 4;

function getEventId(trigger: HTMLElement): string {
  return (
    trigger.dataset.ebEventId ??
    trigger.id
      .replace("eventbrite-widget-modal-trigger-success-", "")
      .replace("eventbrite-widget-modal-trigger-", "")
  );
}

function readTriggerConfig(
  trigger: HTMLElement,
  defaultSection: string,
): EventbriteTriggerConfig {
  return {
    eventId: getEventId(trigger),
    triggerId: trigger.id,
    fallbackUrl:
      trigger.getAttribute("href") ??
      trigger.dataset.ebUrl ??
      trigger.dataset.href ??
      "",
    city: trigger.dataset.city ?? trigger.dataset.phCity ?? "",
    section: trigger.dataset.phSection ?? defaultSection,
    price: trigger.dataset.phPrice ?? "",
    eventDate: trigger.dataset.phEventDate ?? "",
  };
}

function readCheckoutSource(): Record<string, string> | null {
  const raw = sessionStorage.getItem("eb_cta_source");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

function getEventbriteOverlay(): HTMLElement | null {
  return document.getElementById(EVENTBRITE_OVERLAY_ID);
}

function getEventbriteFrame(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>(EVENTBRITE_IFRAME_SELECTOR);
}

function isEventbriteModalPresent(): boolean {
  const overlay = getEventbriteOverlay();
  return Boolean(
    getEventbriteFrame() ||
    (overlay &&
      overlay.style.width !== "" &&
      overlay.style.height !== "" &&
      overlay.style.width !== "0px" &&
      overlay.style.height !== "0px" &&
      overlay.style.opacity !== "0"),
  );
}

function checkoutCleanUrl(): string {
  return (
    window.location.pathname +
    (window.location.hash ? window.location.hash : "")
  );
}

function removeQueryParamFromUrl(param: string): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(param)) return;
  window.history.replaceState(window.history.state, "", checkoutCleanUrl());
}

function installOutsideCloseFallback(onClose: () => void): void {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  let shell = document.getElementById(OUTSIDE_CLOSE_ID);
  if (!shell) {
    shell = document.createElement("div");
    shell.id = OUTSIDE_CLOSE_ID;
    shell.setAttribute("aria-hidden", "true");
    Object.assign(shell.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
    });
    shell.style.setProperty("--eb-modal-w", "min(960px, calc(100vw - 32px))");
    shell.style.setProperty("--eb-modal-h", "min(860px, calc(100vh - 32px))");

    const closeShell = shell;
    const addZone = (zoneStyle: Partial<CSSStyleDeclaration>): void => {
      const zone = document.createElement("button");
      zone.type = "button";
      zone.tabIndex = -1;
      zone.setAttribute("aria-label", "Close checkout");
      zone.setAttribute("data-eb-outside-close-zone", "");
      Object.assign(zone.style, {
        position: "absolute",
        pointerEvents: "auto",
        border: "0",
        padding: "0",
        background: "transparent",
        cursor: "default",
        ...zoneStyle,
      });
      zone.addEventListener("click", (event) => {
        event.preventDefault();
        onClose();
      });
      closeShell.appendChild(zone);
    };

    addZone({
      top: "0",
      left: "0",
      right: "0",
      height: "max(16px, calc((100vh - var(--eb-modal-h)) / 2))",
    });
    addZone({
      bottom: "0",
      left: "0",
      right: "0",
      height: "max(16px, calc((100vh - var(--eb-modal-h)) / 2))",
    });
    addZone({
      top: "calc((100vh - var(--eb-modal-h)) / 2)",
      bottom: "calc((100vh - var(--eb-modal-h)) / 2)",
      left: "0",
      width: "max(16px, calc((100vw - var(--eb-modal-w)) / 2))",
    });
    addZone({
      top: "calc((100vh - var(--eb-modal-h)) / 2)",
      bottom: "calc((100vh - var(--eb-modal-h)) / 2)",
      right: "0",
      width: "max(16px, calc((100vw - var(--eb-modal-w)) / 2))",
    });
  }

  document.body.appendChild(shell);
}

function hideEventbriteOverlay(): void {
  const overlay = getEventbriteOverlay();
  if (!overlay) return;
  overlay.innerHTML = "";
  Object.assign(overlay.style, {
    opacity: "0",
    background: "rgba(0, 0, 0, 0)",
    width: "0",
    height: "0",
  });
}

function ensureEventbriteScript(onReady: () => void): () => void {
  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${EVENTBRITE_WIDGET_SRC}"], script[src*="eb_widgets"]`,
  );

  if (window.EBWidgets?.createWidget) {
    onReady();
    return () => undefined;
  }

  if (existingScript) {
    existingScript.addEventListener("load", onReady, { once: true });
    return () => existingScript.removeEventListener("load", onReady);
  }

  const script = document.createElement("script");
  script.src = EVENTBRITE_WIDGET_SRC;
  script.async = true;
  script.onload = onReady;
  document.head.appendChild(script);

  return () => {
    script.onload = null;
  };
}

export function initEventbriteCheckout(
  options: EventbriteCheckoutOptions = {},
): () => void {
  const triggers = Array.from(
    document.querySelectorAll<HTMLElement>(
      options.selector ?? '[id^="eventbrite-widget-modal-trigger-"]',
    ),
  );
  if (!triggers.length) return () => undefined;

  const hasInjectedWidget = Boolean(window.EBWidgets?.createWidget);
  if (
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    !hasInjectedWidget
  ) {
    return () => undefined;
  }

  const defaultSection = options.defaultSection ?? "";
  const configs = triggers.map((trigger) =>
    readTriggerConfig(trigger, defaultSection),
  );
  const rootStyle = getComputedStyle(document.documentElement);
  const brandColor =
    rootStyle.getPropertyValue("--brand-red").trim() || "#DC2626";
  const fontColor =
    rootStyle.getPropertyValue("--charcoal").trim() || "#1A1A1A";
  const bgColor = rootStyle.getPropertyValue("--white").trim() || "#FFFFFF";

  let orderCompleted = false;
  let modalOpenedAt = 0;
  let savedScrollY = 0;
  let historyEntryPushed = false;
  let modalSessionActive = false;
  let suppressNextPopstate = false;
  let pendingModalTimer: number | undefined;
  let pendingAutoOpenTimer: number | undefined;
  let bodyState: { overflow: string; position: string } | null = null;
  let autoOpenEventId = options.autoOpenQueryParam
    ? (new URLSearchParams(window.location.search).get(
        options.autoOpenQueryParam,
      ) ?? "")
    : "";

  const cleanupCallbacks: Array<() => void> = [];

  function cleanupOutsideCloseFallback(): void {
    document.getElementById(OUTSIDE_CLOSE_ID)?.remove();
  }

  function rememberBodyState(): void {
    if (bodyState) return;
    bodyState = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
    };
  }

  function restoreBodyState(): void {
    if (!bodyState) return;
    document.body.style.overflow = bodyState.overflow;
    document.body.style.position = bodyState.position;
    bodyState = null;
  }

  function cleanAutoOpenQuery(): void {
    if (options.autoOpenQueryParam && options.cleanAutoOpenQuery) {
      removeQueryParamFromUrl(options.autoOpenQueryParam);
    }
  }

  function pushModalHistoryEntry(): void {
    if (historyEntryPushed) return;
    history.pushState(
      { ebModal: true },
      "",
      options.cleanAutoOpenQuery ? checkoutCleanUrl() : location.href,
    );
    historyEntryPushed = true;
  }

  function popModalHistoryEntry(): void {
    if (!historyEntryPushed) return;
    suppressNextPopstate = true;
    historyEntryPushed = false;
    history.back();
  }

  function saveCheckoutSource(
    eventConfig: EventbriteTriggerConfig,
    trigger: HTMLElement,
  ): void {
    sessionStorage.setItem(
      "eb_cta_source",
      JSON.stringify({
        event_id: eventConfig.eventId,
        section: trigger.dataset.phSection || eventConfig.section,
        page: window.location.pathname,
        city: eventConfig.city || trigger.dataset.phCity || "",
        price: trigger.dataset.phPrice || eventConfig.price,
        event_date: trigger.dataset.phEventDate || eventConfig.eventDate,
      }),
    );
  }

  function prepareCheckoutOpen(
    eventConfig: EventbriteTriggerConfig,
    trigger: HTMLElement,
  ): void {
    savedScrollY = window.scrollY;
    rememberBodyState();
    saveCheckoutSource(eventConfig, trigger);
    window.clearTimeout(pendingModalTimer);
    pendingModalTimer = window.setTimeout(() => {
      if (isEventbriteModalPresent()) return;
      cleanupOutsideCloseFallback();
      restoreBodyState();
    }, 5000);
  }

  function trackCheckoutOpened(): void {
    const openData = readCheckoutSource();
    window.posthog?.capture?.("checkout_opened", {
      event_id: openData?.event_id ?? "",
      city: openData?.city ?? "",
      source_section: openData?.section ?? "",
      source_page: openData?.page ?? window.location.pathname,
      price: openData?.price ?? "",
    });
    window.fbq?.("track", "InitiateCheckout", {
      content_ids: [openData?.event_id ?? ""],
      city: openData?.city ?? "",
      value: parseFloat((openData?.price ?? "").replace(/[^0-9.]/g, "") || "0"),
      currency: "USD",
    });
  }

  function beginModalSession(): void {
    if (modalSessionActive) return;
    window.clearTimeout(pendingModalTimer);
    installOutsideCloseFallback(closeEventbriteModal);
    pushModalHistoryEntry();
    modalSessionActive = true;
    orderCompleted = false;
    modalOpenedAt = Date.now();
    trackCheckoutOpened();
    requestAnimationFrame(() => {
      if (savedScrollY > 0) window.scrollTo({ top: savedScrollY });
    });
  }

  function finishModalSession(
    closeOptions: { fromPopstate?: boolean } = {},
  ): void {
    window.clearTimeout(pendingModalTimer);
    cleanupOutsideCloseFallback();
    restoreBodyState();
    if (modalSessionActive && !orderCompleted) {
      const durationMs = modalOpenedAt ? Date.now() - modalOpenedAt : 0;
      const closeData = readCheckoutSource();
      window.posthog?.capture?.("checkout_abandoned", {
        event_id: closeData?.event_id ?? "",
        city: closeData?.city ?? "",
        source_section: closeData?.section ?? "",
        source_page: closeData?.page ?? window.location.pathname,
        price: closeData?.price ?? "",
        duration_seconds: Math.round(durationMs / 1000),
      });
    }
    modalSessionActive = false;
    modalOpenedAt = 0;
    if (!closeOptions.fromPopstate) popModalHistoryEntry();
  }

  function closeEventbriteModal(
    closeOptions: { fromPopstate?: boolean } = {},
  ): void {
    document
      .querySelector<HTMLButtonElement>(".eds-modal__close-button button")
      ?.click();
    getEventbriteFrame()?.remove();
    hideEventbriteOverlay();
    finishModalSession({ fromPopstate: closeOptions.fromPopstate });
  }

  function openRequestedCheckout(): void {
    if (!autoOpenEventId) return;
    const requestedEvent = configs.find(
      (eventConfig) => String(eventConfig.eventId) === String(autoOpenEventId),
    );
    if (!requestedEvent) {
      cleanAutoOpenQuery();
      autoOpenEventId = "";
      return;
    }
    const trigger = document.getElementById(requestedEvent.triggerId);
    if (!trigger) {
      cleanAutoOpenQuery();
      autoOpenEventId = "";
      return;
    }
    clickRequestedCheckout(requestedEvent, trigger);
  }

  function clickRequestedCheckout(
    eventConfig: EventbriteTriggerConfig,
    trigger: HTMLElement,
    attempt = 1,
  ): void {
    autoOpenEventId = "";
    window.clearTimeout(pendingAutoOpenTimer);
    pendingAutoOpenTimer = window.setTimeout(
      () => {
        if (isEventbriteModalPresent() || modalSessionActive) return;
        prepareCheckoutOpen(eventConfig, trigger);
        trigger.click();

        pendingAutoOpenTimer = window.setTimeout(() => {
          if (isEventbriteModalPresent() || modalSessionActive) return;
          if (attempt < AUTO_OPEN_MAX_ATTEMPTS) {
            clickRequestedCheckout(eventConfig, trigger, attempt + 1);
            return;
          }
          if (eventConfig.fallbackUrl) {
            window.location.href = eventConfig.fallbackUrl;
          }
        }, AUTO_OPEN_RETRY_DELAY_MS);
      },
      attempt === 1 ? AUTO_OPEN_INITIAL_DELAY_MS : 0,
    );
  }

  function scheduleRequestedCheckoutOpen(): void {
    if (!autoOpenEventId) return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", openRequestedCheckout, {
        once: true,
      });
      cleanupCallbacks.push(() =>
        document.removeEventListener("DOMContentLoaded", openRequestedCheckout),
      );
      return;
    }
    openRequestedCheckout();
  }

  function initWidgets(): void {
    configs.forEach((eventConfig) => {
      const config: EBWidgetConfig = {
        widgetType: "checkout",
        eventId: eventConfig.eventId,
        modal: true,
        modalTriggerElementId: eventConfig.triggerId,
        themeSettings: {
          brandColor,
          fontColor,
          background: bgColor,
        },
        onWidgetModalClose() {
          finishModalSession();
        },
        onOrderComplete() {
          orderCompleted = true;
          const src = readCheckoutSource();
          sessionStorage.removeItem("eb_cta_source");
          const attr = buildLeadAttribution({ source: "ticket_purchase" });
          window.posthog?.capture?.("order_complete", {
            event_id: eventConfig.eventId,
            city: eventConfig.city,
            source_section: src?.section ?? eventConfig.section,
            source_page: src?.page ?? "",
            price: src?.price ?? eventConfig.price,
            landing_page: attr.landingPage,
            referrer_host: attr.referrerHost,
            utm_source: attr.utmSource,
            utm_campaign: attr.utmCampaign,
            utm_medium: attr.utmMedium,
            utm_content: attr.utmContent,
          });
          const price = parseFloat(
            (src?.price ?? eventConfig.price ?? "").replace(/[^0-9.]/g, "") ||
              "0",
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
                  item_name: `Garam Masala Dating - ${eventConfig.city}`,
                  item_id: String(eventConfig.eventId),
                  price,
                  quantity: 1,
                },
              ],
            },
            source_section: src?.section ?? eventConfig.section,
            source_page: src?.page ?? "",
            landing_page: attr.landingPage,
            referrer_host: attr.referrerHost,
            utm_source: attr.utmSource,
            utm_campaign: attr.utmCampaign,
          });
          window.fbq?.("track", "Purchase", {
            value: price,
            currency: "USD",
            content_ids: [String(eventConfig.eventId)],
          });
        },
      };

      try {
        if (!window.EBWidgets?.createWidget) {
          throw new Error("Eventbrite widget API unavailable");
        }
        window.EBWidgets.createWidget(config);
        const trigger = document.getElementById(eventConfig.triggerId);
        const onClick = (event: MouseEvent): void => {
          event.preventDefault();
          if (trigger) {
            prepareCheckoutOpen(eventConfig, trigger);
          }
        };
        trigger?.addEventListener("click", onClick);
        if (trigger) {
          cleanupCallbacks.push(() =>
            trigger.removeEventListener("click", onClick),
          );
        }
      } catch {
        window.posthog?.capture?.("widget_load_failed", {
          event_id: eventConfig.eventId,
          city: eventConfig.city,
          page: window.location.pathname,
        });
      }
    });
    scheduleRequestedCheckoutOpen();
  }

  const cleanupScript = ensureEventbriteScript(initWidgets);
  cleanupCallbacks.push(cleanupScript);

  const onPopState = (): void => {
    if (suppressNextPopstate) {
      suppressNextPopstate = false;
      cleanAutoOpenQuery();
      return;
    }
    if (
      !historyEntryPushed &&
      !modalSessionActive &&
      !isEventbriteModalPresent()
    ) {
      return;
    }
    historyEntryPushed = false;
    closeEventbriteModal({ fromPopstate: true });
    cleanAutoOpenQuery();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && isEventbriteModalPresent()) {
      closeEventbriteModal();
    }
  };

  window.addEventListener("popstate", onPopState);
  window.addEventListener("keydown", onKeyDown);
  cleanupCallbacks.push(() => {
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("keydown", onKeyDown);
  });

  const modalObserver = new MutationObserver(() => {
    if (isEventbriteModalPresent()) {
      beginModalSession();
      return;
    }
    if (modalSessionActive) {
      finishModalSession();
    }
  });
  modalObserver.observe(document.body, { childList: true, subtree: true });
  cleanupCallbacks.push(() => modalObserver.disconnect());

  return () => {
    window.clearTimeout(pendingModalTimer);
    window.clearTimeout(pendingAutoOpenTimer);
    cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
  };
}
