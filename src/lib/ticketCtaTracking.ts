import { capture } from "@/lib/analytics";
import { getStoredUtms } from "@/lib/leadAttribution";

// WHY module scope instead of inside wireTicketCtaTracking(): several
// independently-authored components can call wireTicketCtaTracking() on one
// page load (see the function's own doc comment), but Vite dedupes this
// module to one instance, so a plain boolean here still only registers the
// pageshow listener once per page, not once per caller.
let pageshowListenerWired = false;

/**
 * Restores a same-tab CTA's label if the visitor lands back on this page via
 * the back/forward cache (bfcache): browsers can restore the exact DOM state
 * a page was in when the visitor navigated away, which would otherwise leave
 * the button permanently reading "Opening Checkout..." after a trip to
 * Eventbrite and back.
 */
function wireBfcacheRestore(): void {
  if (pageshowListenerWired) return;
  pageshowListenerWired = true;

  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    document
      .querySelectorAll<HTMLAnchorElement>('[data-cta-loading="true"]')
      .forEach((anchor) => {
        anchor.removeAttribute("aria-busy");
        delete anchor.dataset.ctaLoading;
        if (anchor.dataset.originalLabel) {
          anchor.textContent = anchor.dataset.originalLabel;
        }
      });
  });
}

/**
 * Wires every `[data-go-ticket]` anchor currently in the DOM: stamps a
 * stable event_id, forwards UTMs onto the `/api/go/[slug]` href, and on
 * click fires `checkout_opened` (-> InitiateCheckout) before navigating to
 * checkout.
 *
 * Extracted out of EventTicketCta.astro (the /events/[slug] page's CTA) so
 * every other ticket CTA on the site (TicketCard.astro on /tickets,
 * HomeShows.astro and HomeHero.astro on home, CityEventTicketEmbed.astro
 * on city pages) shares one click/tracking implementation instead of five
 * near-duplicate inline scripts. This is also what replaced the Eventbrite
 * modal/iframe embed's tracking (see EventbriteWidgetInit.astro, retired).
 *
 * Idempotent: Astro re-executes each component's top-level `<script>` once
 * per page load, and several independently-authored components that all
 * call this function can appear on the same page (e.g. the home page mounts
 * both HomeHero and HomeShows). The `data-cta-wired` marker stops a second
 * call from double-attaching a click listener to an anchor the first call
 * already wired.
 */
export function wireTicketCtaTracking(): void {
  wireBfcacheRestore();

  document
    .querySelectorAll<HTMLAnchorElement>(
      "[data-go-ticket]:not([data-cta-wired])",
    )
    .forEach((anchor) => {
      anchor.dataset.ctaWired = "true";

      // One id per anchor, generated once on load (not per click) so a
      // presale button that flips from hidden to visible mid-visit (see
      // src/lib/presaleReveal.ts) still carries the same id it would have
      // had all along. Stashed on the element so the click handler and the
      // paired server-side CAPI call (src/pages/api/go/[slug].ts) agree on
      // one event_id and Meta dedupes the two deliveries.
      const eid = crypto.randomUUID();
      anchor.dataset.eventId = eid;

      try {
        const url = new URL(anchor.href, window.location.origin);
        url.searchParams.set("eid", eid);
        const stored = getStoredUtms();
        const params = new URLSearchParams(window.location.search);
        const forwarded: Record<string, string | undefined> = {
          utm_source: stored.utmSource ?? params.get("utm_source") ?? undefined,
          utm_medium: stored.utmMedium ?? params.get("utm_medium") ?? undefined,
          utm_campaign:
            stored.utmCampaign ?? params.get("utm_campaign") ?? undefined,
          utm_content:
            stored.utmContent ?? params.get("utm_content") ?? undefined,
          utm_term: stored.utmTerm ?? params.get("utm_term") ?? undefined,
        };
        for (const [key, value] of Object.entries(forwarded)) {
          if (value) url.searchParams.set(key, value);
        }
        anchor.href = url.toString();
      } catch {
        /* keep the plain /api/go/[slug] href if URL construction fails */
      }

      anchor.addEventListener("click", (e) => {
        // Click-guard: a second click/tap/Enter during the loading window
        // (CSS also sets pointer-events: none on [aria-busy], but that
        // doesn't stop keyboard activation) must not re-fire capture() below
        // or restart the delayed navigation. preventDefault() here too
        // (caught by Codex review, 2026-08-27): this flag is only ever set
        // by the same-tab branch below, so a guarded return always means
        // "this anchor's native navigation must stay deferred to the
        // setTimeout below" -- without it, a second Enter/click inside the
        // 100ms window navigates immediately via the browser's default
        // action, which can outrun the beacon flush that delay exists for.
        if (anchor.dataset.ctaLoading === "true") {
          e.preventDefault();
          return;
        }

        const me = e as MouseEvent;
        const isModified =
          me.metaKey ||
          me.ctrlKey ||
          me.shiftKey ||
          me.altKey ||
          me.button !== 0;

        capture(
          "checkout_opened",
          {
            event_id: anchor.dataset.eventId,
            event_slug: anchor.dataset.eventSlug,
            event_city: anchor.dataset.eventCity,
            event_date: anchor.dataset.eventDate,
            event_title: anchor.dataset.eventTitle,
            event_vendor: anchor.dataset.eventVendor,
            cta_position: anchor.dataset.ctaPosition,
            cta_text: anchor.dataset.ctaText,
          },
          { eventId: anchor.dataset.eventId },
        );

        if (isModified) return; // let the browser handle new-tab/window clicks

        // WHY: target="_blank" anchors (home/tickets/city cards) must NOT
        // preventDefault. Popup blockers require window.open()-equivalent
        // navigation to happen synchronously inside the user-gesture call
        // stack; an earlier version wrapped it in a setTimeout to match the
        // same-tab delay below, which broke out of that stack and let
        // browsers silently block the new tab, killing the primary CTA on
        // every page that opens tickets in a new tab. Letting the native
        // `target="_blank"` navigation proceed immediately keeps it inside
        // the gesture. The current page is never torn down for a new-tab
        // click, so capture()'s beacon (already fired above) still has the
        // full remaining page lifetime to flush; no delay is needed here.
        if (anchor.target === "_blank") return;

        // Same-tab handoff only (the event landing page CTA, which has no
        // target attribute): delay navigation so the PostHog/Pixel beacon
        // has time to flush before the browser tears the current page down
        // (same pattern as trackOutbound() in src/lib/analyticsCapture.ts).
        e.preventDefault();
        const href = anchor.href;

        // Instant loading state: this is the only ticket CTA that replaces
        // the current tab, so without visible feedback the click reads as
        // dead for however long the redirect + navigation actually take.
        // Stashing the original label lets wireBfcacheRestore() above put it
        // back if the visitor returns via the back/forward cache.
        anchor.dataset.originalLabel = anchor.textContent ?? "";
        anchor.dataset.ctaLoading = "true";
        anchor.setAttribute("aria-busy", "true");
        anchor.textContent = "Opening Checkout…";
        const spinner = document.createElement("span");
        spinner.className = "event-cta__spinner";
        spinner.setAttribute("aria-hidden", "true");
        anchor.appendChild(spinner);

        window.setTimeout(() => {
          window.location.href = href;
        }, 100);
      });
    });
}
