/**
 * The live show list for server routes (issue 337, plan section 5 and R5).
 *
 * Static pages render the snapshot baked into the build
 * (src/data/events.published.json). Runtime routes (the /api/go ticket
 * redirect, order sync, attribution, casting) instead read the published
 * snapshot from `eventsPublished/current`, so a canceled show or a changed
 * checkout link takes effect within LIVE_EVENTS_TTL_MS on every instance,
 * minutes before the rebuild lands.
 *
 * Failure is always safe: until Firestore answers, and whenever it fails or
 * holds no published version yet, routes get the last good list, which on a
 * cold instance is exactly the baked snapshot. This never throws.
 */
import { waitUntil } from "@vercel/functions";
import {
  buildAllEvents,
  publishedSnapshot,
  type EventEntry,
  type EventsSnapshot,
} from "@/data/events";
import { withTimeout } from "@/utils/withTimeout";
import { readPublishedEventsPublic } from "./eventsStore.server";
import { firestoreProjectId } from "./firestoreRest";
import { alertOps } from "./opsAlert";

/** How old the cached list may get before a request refreshes it. */
export const LIVE_EVENTS_TTL_MS = 30_000;
/** How long a request waits on Firestore before serving the last good list. */
export const LIVE_EVENTS_DEADLINE_MS = 1_500;

export interface LiveEvents {
  /** Every show record, including hidden and canceled ones (like `events`). */
  events: EventEntry[];
  /** Shows plus TBA city cards, computed for today (like `allEvents`). */
  allEvents: EventEntry[];
}

let lastGood: EventsSnapshot = publishedSnapshot;
/** When the last read finished, success or not; undefined on a cold instance. */
let checkedAt: number | undefined;
let pending: Promise<void> | undefined;
let failing = false;

async function refresh(): Promise<void> {
  const controller = new AbortController();
  try {
    const stored = await withTimeout(
      readPublishedEventsPublic(controller.signal),
      LIVE_EVENTS_DEADLINE_MS,
      "published events read",
    );
    // WHY a missing document keeps the baked list without alerting: before
    // the one-time seed runs there is no published version, and the site
    // must behave exactly as the build rendered it.
    if (stored) lastGood = stored.data.snapshot;
    failing = false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      "[published-events] Live read failed; serving the last good show list",
      message,
    );
    // WHY alert only when a failure streak starts: during an outage every
    // instance retries each TTL, and one page per streak is enough to act.
    if (!failing) {
      failing = true;
      waitUntil(
        alertOps({
          flow: "ops",
          stage: "events_live_read",
          errorMessage: message,
        }),
      );
    }
  } finally {
    // Cancels the request if the deadline won the race.
    controller.abort();
    // WHY a failed read also restarts the TTL: otherwise, while Firestore is
    // down, every request would wait the full deadline on the ticket
    // redirect path. One request per instance per TTL pays it instead.
    checkedAt = Date.now();
  }
}

/**
 * The published show list, at most LIVE_EVENTS_TTL_MS old unless Firestore
 * is failing. Concurrent callers share one read (single flight).
 */
export async function getLiveEvents(): Promise<LiveEvents> {
  // WHY skip quietly with no project id: Astro inlines it at build time, and
  // CI and local builds run without it. The read could only throw "project id
  // is required", which used to log a failure and page ops on every packaged
  // runtime check. That is a known configuration, not an outage: the baked
  // list is the right answer there. Vercel builds always carry the id, so a
  // real Firestore failure in production still logs and alerts below.
  const stale =
    checkedAt === undefined || Date.now() - checkedAt >= LIVE_EVENTS_TTL_MS;
  if (stale && firestoreProjectId()) {
    pending ??= refresh().finally(() => {
      pending = undefined;
    });
    await pending;
  }
  return {
    events: lastGood.events,
    // WHY computed per call rather than cached: TBA cards and past shows
    // depend on today's date, and a warm instance outlives midnight. It is a
    // filter over a few dozen entries.
    allEvents: buildAllEvents(lastGood, new Date().toISOString().slice(0, 10)),
  };
}
