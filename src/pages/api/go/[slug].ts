export const prerender = false;

import type { APIRoute } from "astro";
import { getEventBySlug } from "@/data/events";
import { enforceRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rateLimit";
import { applyUtmsToUrl } from "@/utils/utmForwarding";
import { withTimeout } from "@/utils/withTimeout";
import { sendCapiEvent } from "@/lib/capi";
import { isBotUserAgent } from "@/lib/isBotUserAgent";

// WHY a bounded timeout instead of letting the CAPI call run free: this
// route's entire purpose is firing the tracking event, so the call is
// awaited (not fire-and-forget): Vercel Node serverless functions are not
// guaranteed to keep running after the response is sent, so an unawaited
// call risks being cut off before it completes, silently losing the event.
// The 2s ceiling caps the worst case (a slow/hanging Meta API call) so a
// tracking hiccup never meaningfully delays the visitor's redirect to
// checkout; a typical Graph API call completes in well under 300ms.
const CAPI_TIMEOUT_MS = 2000;

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
  const limited = await enforceRateLimit(request, RATE_LIMITS.goRedirect);
  if (limited) return limited;

  const slug = params.slug;
  const event = slug ? getEventBySlug(slug) : undefined;

  if (!event || !event.url || event.url === "#") {
    return new Response("Not found", { status: 404 });
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
  const userAgent = request.headers.get("user-agent");
  const accessToken = import.meta.env.META_CAPI_ACCESS_TOKEN;
  if (accessToken && !isBotUserAgent(userAgent)) {
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
    headers: { Location: destination },
  });
};
