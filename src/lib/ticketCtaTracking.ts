import { capture } from "@/lib/analytics";
import { getStoredUtms } from "@/lib/leadAttribution";

/**
 * Wires every `[data-go-ticket]` anchor currently in the DOM: mints a stable
 * event_id, forwards UTMs onto the `/api/go/[slug]` href, and on activation
 * (left click or middle click) fires `checkout_opened` (-> InitiateCheckout)
 * and stamps the event_id onto the href before navigating to checkout.
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

      // Shared by the `click` and `auxclick` listeners below: everything a
      // ticket CTA does when the visitor actually activates it.
      const onActivate = (me: MouseEvent): void => {
        // WHY the eid goes on at click time and not at load time with the
        // UTMs: an href that already carries it is prefetchable, and the
        // browser's own prefetch (Chrome's "preload pages", speculation
        // rules) sends the visitor's real UA and cookies, so the server had
        // no way to tell that speculative fetch apart from a click. Stamping
        // it here also means the URL a click navigates to is never the URL a
        // prefetcher already cached, so a prefetch cache hit can't swallow
        // the click and cost us the conversion. Mutating href inside the
        // listener still changes where the default navigation goes, so this
        // works for new-tab clicks and the same-tab path below alike.
        //
        // This can only cover activations that fire a mouse event on the
        // anchor. The activations it cannot see (context-menu "Open link in
        // new tab", dragging the link to a tab bar) are covered instead by
        // the `Cache-Control: no-store` the route itself returns, which keeps
        // a prefetched response from ever standing in for a real navigation.
        try {
          const url = new URL(anchor.href, window.location.origin);
          url.searchParams.set("eid", eid);
          anchor.href = url.toString();
        } catch {
          /* navigate with the plain href if URL construction fails */
        }

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
        me.preventDefault();
        const href = anchor.href;
        window.setTimeout(() => {
          window.location.href = href;
        }, 100);
      };

      anchor.addEventListener("click", (e) => onActivate(e as MouseEvent));

      // WHY auxclick and not just the `me.button !== 0` branch above: `click`
      // only fires for the primary button. A middle-click, which every
      // browser treats as "open this link in a new tab", fires `auxclick`
      // instead, so it used to reach checkout with neither a
      // `checkout_opened` event nor an `eid` on the href, and the bare URL it
      // navigated to was exactly the one a prefetcher may already have
      // cached. Same handler, same per-anchor id: onActivate sees
      // `button !== 0`, so it stamps and reports, then returns without
      // touching the native new-tab navigation. Caught by Codex review
      // (2026-08-26).
      //
      // Button 2 is deliberately ignored: the right button opens a context
      // menu, which is not yet a navigation, and counting it as one would
      // report checkout intents for a menu the visitor may just dismiss.
      // A tab actually opened from that menu is covered by the route's
      // no-store response instead.
      anchor.addEventListener("auxclick", (e) => {
        const me = e as MouseEvent;
        if (me.button !== 1) return;
        onActivate(me);
      });
    });
}
