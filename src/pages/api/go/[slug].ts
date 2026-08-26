export const prerender = false;

import type { APIRoute } from "astro";
import { getEventBySlug } from "@/data/events";
import { isEventDatePast } from "@/utils/eventDate";
import { enforceRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rateLimit";
import { applyUtmsToUrl } from "@/utils/utmForwarding";
import { withTimeout } from "@/utils/withTimeout";
import { sendCapiEvent } from "@/lib/capi";
import { isBotUserAgent } from "@/lib/isBotUserAgent";
import { isSpeculativeRequest } from "@/lib/isSpeculativeRequest";

// WHY a bounded timeout instead of letting the CAPI call run free: this
// route's entire purpose is firing the tracking event, so the call is
// awaited (not fire-and-forget): Vercel Node serverless functions are not
// guaranteed to keep running after the response is sent, so an unawaited
// call risks being cut off before it completes, silently losing the event.
// The 2s ceiling caps the worst case (a slow/hanging Meta API call) so a
// tracking hiccup never meaningfully delays the visitor's redirect to
// checkout; a typical Graph API call completes in well under 300ms.
const CAPI_TIMEOUT_MS = 2000;

// WHY every response from this route is non-storable: filtering speculative
// fetches out of CAPI (isSpeculativeRequest, below) stops them being counted
// as conversions, but the prefetched 302 still lands in the browser's cache,
// and a cached 302 can then satisfy the visitor's REAL activation without the
// request ever reaching us. The conversion the prefetch was correctly denied
// is then never fired by the click either, and the loss is invisible from
// here: the click simply never arrives. Marking the redirect no-store means a
// speculative fetch can never stand in for a real one, whichever way the
// visitor triggers it (left click, middle click, "Open link in new tab",
// dragging the link to a tab, a no-JS navigation), which is broader than any
// client-side handler can cover. Caught by Codex review (2026-08-26).
// Nothing here is worth caching anyway: it is a 302 whose whole purpose is
// firing one tracking event, and a repeat click is a repeat intent we want to
// see. This also keeps Vercel's edge from serving the redirect for us.
const NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

function readCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Tracked redirect: every "Get Tickets" click across the site routes through
 * here. Fires a server-side Meta CAPI InitiateCheckout (unblockable by ad
 * blockers/ITP, and the only tracking signal possible for shows we don't
 * own, see TicketSource in src/data/events.ts), forwards the visitor's
 * UTMs, then 302s to the real checkout.
 *
 * The destination URL is ALWAYS resolved server-side from our own event
 * data by slug, never from a client-supplied URL param, so this can't be
 * turned into an open redirect. Unknown slugs, and events that don't have a
 * real checkout destination yet (TBA/coming-soon shows use url: ""), 404.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug;
  const event = slug ? getEventBySlug(slug) : undefined;

  if (!event || !event.url || event.url === "#") {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }

  // WHY canceled and past shows redirect to /tickets instead of the stored
  // url: entries are never deleted (never-delete events rule), landing pages
  // are permanent, and old shared/bookmarked /api/go links keep arriving
  // after a show is canceled or over. The stored url then points at a
  // listing that cannot sell anything, and the past check in
  // EventTicketCta.astro is frozen at build time, so without this runtime
  // guard a stale static page would keep handing out live checkout links
  // between deploys. Skipping the redirect to the dead listing also means
  // no InitiateCheckout fires for an unbuyable show, which would otherwise
  // feed Meta's ad optimization a false conversion signal.
  if (event.status === "canceled" || isEventDatePast(event)) {
    return new Response(null, {
      status: 302,
      headers: { ...NO_STORE, Location: "/tickets" },
    });
  }

  const requestUrl = new URL(request.url);

  // Stamped onto the href by the "Get Tickets" click handler at click time
  // (src/lib/ticketCtaTracking.ts) and passed through as ?eid=, so the
  // browser Pixel event and this server CAPI event share one event_id and
  // Meta dedupes them into a single conversion. Falls back to a
  // server-generated id for a real navigation that arrives without one
  // (no-JS fallback, shared/bookmarked link): still a valid, if unpaired,
  // signal. A missing eid is NOT what filters non-clicks: speculative
  // fetches are caught by header, below.
  const eventId = requestUrl.searchParams.get("eid") || crypto.randomUUID();

  const destination = applyUtmsToUrl(
    event.url,
    {
      utmSource: requestUrl.searchParams.get("utm_source") ?? undefined,
      utmMedium: requestUrl.searchParams.get("utm_medium") ?? undefined,
      utmCampaign: requestUrl.searchParams.get("utm_campaign") ?? undefined,
      utmContent: requestUrl.searchParams.get("utm_content") ?? undefined,
      utmTerm: requestUrl.searchParams.get("utm_term") ?? undefined,
    },
    {
      utmSource: "garamsite",
      utmMedium: "web",
      utmCampaign: event.citySlug ?? "event",
      utmContent: event.slug,
    },
  );

  // WHY skip CAPI for recognized bots but still redirect them: the
  // rateLimit.ts goRedirect policy comment already documents that
  // Meta/iMessage/Slack unfurl bots headlessly fetch this exact route
  // whenever a tracked link is shared, since ad and ticket links point
  // straight here. Left unfiltered, every one of those non-human fetches
  // was reported to Meta as a real InitiateCheckout, which doesn't just
  // inflate a vanity metric: it's a training signal the ad algorithm uses
  // to find more people who look like whoever converted, so bot traffic
  // labeled as conversions actively degrades ad targeting. Caught by Codex
  // pre-push review (2026-08-03). The redirect below still runs
  // unconditionally for bots too, since they need the real destination to
  // build an accurate link-preview card.
  //
  // WHY the separate speculative check: the User-Agent denylist can only
  // catch fetches made by someone else's server. A browser prefetching this
  // link on the visitor's behalf (Chrome's "preload pages", speculation
  // rules, `<link rel=prefetch>`) sends the visitor's own browser UA, so it
  // sails through the denylist and was counted as a conversion for a click
  // that never happened, the same ad-targeting poison as an unfurl bot.
  // Speculative requests still get the 302, and the honest one: answering
  // them with anything else would break the navigation if the visitor does
  // go on to click. It costs us nothing to be honest here because NO_STORE
  // above keeps that answer out of the cache, so the click still comes back
  // to us to be counted rather than being served from the prefetch.
  const userAgent = request.headers.get("user-agent");
  const accessToken = import.meta.env.META_CAPI_ACCESS_TOKEN;
  const eligible =
    Boolean(accessToken) &&
    !isBotUserAgent(userAgent) &&
    !isSpeculativeRequest(request);

  // WHY the rate limit only suppresses tracking instead of returning its
  // 429: every real "Get Tickets" click routes through here, so a
  // shared-IP burst (one venue/campus/office NAT, or a viral moment) that
  // trips the limit must still deliver every buyer to checkout. The
  // expensive, abusable part of this route is the Meta CAPI call, so that
  // is what the limit gates; the redirect itself is a cheap, server-resolved
  // 302 that never uses client-supplied URLs.
  //
  // WHY it runs after the eligibility checks and not before: every call to
  // enforceRateLimit SPENDS one unit of the shared per-IP budget, and a
  // browser prefetch arrives on the visitor's own IP. Charging prefetches
  // and unfurl bots for a Meta call they were never going to make let a
  // page that speculates over several ticket links burn the 30/minute
  // budget on nobody, so the visitor's real click moments later found it
  // empty and went untracked: the rate limit meant to protect the CAPI
  // spend was suppressing the exact conversions it exists to preserve.
  // The budget is now only spent by requests that have earned a Meta call.
  // Caught by Codex review (2026-08-26).
  const limited = eligible
    ? await enforceRateLimit(request, RATE_LIMITS.goRedirect)
    : null;

  if (eligible && !limited) {
    const cookieHeader = request.headers.get("cookie");
    try {
      const result = await withTimeout(
        sendCapiEvent(
          {
            eventName: "InitiateCheckout",
            eventId,
            eventTime: Math.floor(Date.now() / 1000),
            eventSourceUrl: requestUrl.toString(),
            userData: {
              clientIpAddress: getClientIp(request),
              clientUserAgent: userAgent ?? undefined,
              fbp: readCookie(cookieHeader, "_fbp"),
              fbc: readCookie(cookieHeader, "_fbc"),
            },
            customData: {
              contentIds: [event.slug],
              contentType: "event",
            },
          },
          accessToken,
        ),
        CAPI_TIMEOUT_MS,
        "Meta CAPI InitiateCheckout",
      );
      if (!result.ok) {
        console.error(
          `[go] CAPI InitiateCheckout failed for ${event.slug}: ${result.error}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[go] CAPI InitiateCheckout did not confirm for ${event.slug}: ${msg}`,
      );
    }
  }

  return new Response(null, {
    status: 302,
    headers: { ...NO_STORE, Location: destination },
  });
};
