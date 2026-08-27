/**
 * Build-time pull of an Eventbrite event's own listing content, so our
 * owned-show landing pages can mirror what's actually live on Eventbrite
 * instead of drifting from a manually-typed description over time.
 *
 * Named `eventbriteContent` (not `eventbrite`) to avoid colliding with
 * src/lib/eventbrite.ts, which handles order sync for analytics: a
 * different Eventbrite API surface entirely.
 *
 * Only ever called for `ticketSource === "eventbrite-owned"` events. A
 * third-party listing (`ticketSource: "external"`, e.g. the Los Angeles
 * show) is never queried here: we have no right to represent someone
 * else's Eventbrite listing as sourced content.
 *
 * WHY this fails soft, not hard: these calls run during `astro build`
 * (invoked from getStaticPaths), not at request time. A transient
 * Eventbrite API hiccup or rate limit must never fail the entire static
 * build over one show's summary blurb: every call is wrapped and falls
 * back to the event's manual `description` field in src/data/events.ts.
 */

export interface EventbriteContent {
  name: string | null;
  summary: string | null;
  logoUrl: string | null;
}

interface EBEventResponse {
  name?: { text?: string };
  summary?: string;
  logo?: { url?: string };
}

export async function fetchEventbriteContent(
  eventbriteId: string,
  token: string,
): Promise<EventbriteContent | null> {
  try {
    const url = new URL(
      `https://www.eventbriteapi.com/v3/events/${eventbriteId}/`,
    );
    url.searchParams.set("expand", "logo");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      // WHY a timeout on a build-time call: getStaticPaths awaits this fetch
      // for every owned event during `astro build`, so a single hung
      // Eventbrite request (no response, not an error) would stall the whole
      // deployment forever. Errors already fail soft to manual content via
      // the surrounding catch; the abort turns a hang into that same path.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      process.stdout.write(
        `[eventbriteContent] ${eventbriteId} fetch failed: ${res.status}, using manual content\n`,
      );
      return null;
    }

    const data = (await res.json()) as EBEventResponse;

    return {
      name: data.name?.text ?? null,
      summary: data.summary?.trim() || null,
      logoUrl: data.logo?.url ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      `[eventbriteContent] ${eventbriteId} fetch error: ${msg}, using manual content\n`,
    );
    return null;
  }
}

/**
 * Merge pulled Eventbrite content over manual event data. Eventbrite's
 * `summary` is the organizer's short listing blurb and only overrides our
 * manual description when the pull succeeded and returned non-empty text.
 *
 * The hero image is deliberately never sourced from Eventbrite: organizer
 * logos vary wildly in quality/aspect ratio and would break the
 * consistent, designed look every event page must share regardless of
 * who is running the show (see CLAUDE.md aesthetic rules). Every event
 * page uses site-owned photography for its hero, full stop.
 */
export function resolveEventDescription(
  manualDescription: string,
  content: EventbriteContent | null,
): string {
  return content?.summary ?? manualDescription;
}
