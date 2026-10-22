export const prerender = false;

import type { APIRoute } from "astro";
import { waitUntil } from "@vercel/functions";
import { getEventBySlug, type EventEntry } from "@/data/events";
import { isEventDatePast } from "@/utils/eventDate";
import { enforceRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rateLimit";
import { applyUtmsToUrl } from "@/utils/utmForwarding";
import { withTimeout } from "@/utils/withTimeout";
import { sendCapiEvent } from "@/lib/capi";
import { isBotUserAgent } from "@/lib/isBotUserAgent";

// WHY a bounded timeout on the CAPI call: even though this now runs in the
// background (see waitUntil() below), Vercel Functions still have a hard max
// duration, and a hanging Meta API call would otherwise hold the background
// task open indefinitely. The 2s ceiling caps the worst case; a typical
// Graph API call completes in well under 300ms.
const CAPI_TIMEOUT_MS = 2000;

function readCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// WHY this runs after the redirect instead of before it: the visitor is only
// waiting on the Location header, never on the rate-limit check or the Meta
// call. waitUntil() (see GET below) keeps this function alive past the
// response, which is only guaranteed to actually finish because this
// project has Fluid Compute enabled (verified in Vercel Project Settings ->
// Functions, 2026-08-27); without it a serverless function is not guaranteed
// to keep running once the response has been sent, and this work could be
// silently cut off. Never throws: nothing is awaiting this call, so a thrown
// error here would surface only as an unhandled rejection in the function
// logs, not as anything actionable.
async function recordClickSignals(
  request: Request,
  requestUrl: URL,
  event: EventEntry,
  eventId: string,
): Promise<void> {
  // WHY the rate limit only suppresses tracking instead of ever blocking the
  // visitor: every real "Get Tickets" click routes through this route, so a
  // shared-IP burst (one venue/campus/office NAT, or a viral moment) that
  // trips the limit must still have delivered every buyer to checkout by the
  // time this runs. The expensive, abusable part of this route is the Meta
  // CAPI call, so that is what the limit gates.
  const limited = await enforceRateLimit(request, RATE_LIMITS.goRedirect);

  // WHY skip CAPI for recognized bots: the rateLimit.ts goRedirect policy
  // comment already documents that Meta/iMessage/Slack unfurl bots
  // headlessly fetch this exact route whenever a tracked link is shared,
  // since ad and ticket links point straight here. Left unfiltered, every
  // one of those non-human fetches was reported to Meta as a real
  // InitiateCheckout, which doesn't just inflate a vanity metric: it's a
  // training signal the ad algorithm uses to find more people who look like
  // whoever converted, so bot traffic labeled as conversions actively
  // degrades ad targeting. Caught by Codex pre-push review (2026-08-03).
  const userAgent = request.headers.get("user-agent");
  const accessToken = import.meta.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken || limited || isBotUserAgent(userAgent)) return;

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

/**
 * Tracked redirect: every "Get Tickets" click across the site routes through
 * here. Resolves the real checkout URL from our own event data and 302s
 * immediately; a server-side Meta CAPI InitiateCheckout (unblockable by ad
 * blockers/ITP, and the only tracking signal possible for shows we don't
 * own, see TicketSource in src/data/events.ts) fires afterward in the
 * background, see recordClickSignals() above.
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
    return new Response("Not found", { status: 404 });
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
      headers: { Location: "/tickets" },
    });
  }

  const requestUrl = new URL(request.url);

  // Generated client-side by the "Get Tickets" click handler and passed
  // through as ?eid=, so the browser Pixel event and this server CAPI event
  // share one event_id and Meta dedupes them into a single conversion. Falls
  // back to a server-generated id for any request that arrives without one
  // (no-JS fallback, direct link, bot): still a valid, if unpaired, signal.
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

  waitUntil(recordClickSignals(request, requestUrl, event, eventId));

  return new Response(null, {
    status: 302,
    headers: { Location: destination },
  });
};
