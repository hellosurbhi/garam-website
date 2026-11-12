/**
 * Pure view logic for the admin Shows tab (issue 337): which state the
 * website is in after a publish (R15), whether the buttons are locked, and
 * the preview of how each draft show will appear on the public site.
 */
import {
  buildAllEvents,
  getEventDisplayStatus,
  isDisplayable,
} from "@/data/events";
import {
  REBUILD_DEBOUNCE_MS,
  REBUILD_STUCK_MS,
  type EventEntry,
  type EventsSnapshot,
  type SnapshotDiff,
} from "@/data/eventsSnapshot";
import { SHOWS_LIST } from "@/data/adminShows";
import type { WaitlistPreview } from "@/lib/eventsAdmin.server";
import type { PublishedEvents } from "@/lib/eventsStore.server";
import { getTicketPageUpcoming } from "@/utils/eventFilters";

type LiveState = Pick<PublishedEvents, "version" | "rebuild">;

export type SitePhase =
  | { kind: "onSite" }
  | { kind: "checking" }
  | { kind: "rebuilding"; minutes: number }
  | { kind: "stuck" }
  | { kind: "notRequested" };

/**
 * Where the website is relative to the live version. `siteVersion` is
 * undefined before /api/version answered and null when it failed.
 * WHY time based: there is no Vercel API token (R15), so a failed or stuck
 * build is only visible as "still not live after 20 minutes".
 */
export function sitePhase(
  live: LiveState,
  siteVersion: number | null | undefined,
  now: number,
): SitePhase {
  if (siteVersion === live.version) return { kind: "onSite" };
  if (siteVersion === undefined) return { kind: "checking" };
  const rebuild = live.rebuild?.version === live.version ? live.rebuild : null;
  if (!rebuild) return { kind: "notRequested" };
  const ageMs = now - Date.parse(rebuild.requestedAt);
  if (ageMs >= REBUILD_STUCK_MS) return { kind: "stuck" };
  return { kind: "rebuilding", minutes: Math.floor(ageMs / 60_000) };
}

/** Milliseconds until Publish, Restore and Rebuild unlock; 0 when unlocked (R15). */
export function lockRemainingMs(live: LiveState, now: number): number {
  if (!live.rebuild) return 0;
  const unlockAt = Date.parse(live.rebuild.requestedAt) + REBUILD_DEBOUNCE_MS;
  return Math.max(0, unlockAt - now);
}

export function countChanges(diff: SnapshotDiff): number {
  return Object.values(diff).reduce((sum, slugs) => sum + slugs.length, 0);
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Nov 3, 2026" for an ISO timestamp. */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d);
}

/** "Chicago, Jan 9" for a show, the way the owner names it. */
export function showName(e: Pick<EventEntry, "city" | "date">): string {
  return `${e.city}, ${e.date}`;
}

export interface ShowPreview {
  label: string;
  /** "listed" shows on /tickets; "off" never reaches the public list. */
  tone: "listed" | "off";
}

/**
 * How each draft show will read on /tickets, computed with the same
 * functions the page uses (buildAllEvents, getTicketPageUpcoming,
 * getEventDisplayStatus), so the preview cannot disagree with the page.
 * `waitlist` is the page's own Notify Me selection for this snapshot,
 * made on the server by previewWaitlist.
 */
export function previewShows(
  snapshot: EventsSnapshot,
  todayIso: string,
  waitlist: WaitlistPreview,
): Map<string, ShowPreview> {
  const listed = new Set(
    getTicketPageUpcoming(buildAllEvents(snapshot, todayIso), todayIso).map(
      (e) => e.slug,
    ),
  );
  const notify = new Set(waitlist.datedSlugs);
  const out = new Map<string, ShowPreview>();
  for (const e of snapshot.events) {
    if (listed.has(e.slug)) {
      const status = getEventDisplayStatus(e);
      const label = status
        ? `${SHOWS_LIST.listed}: ${status}`
        : SHOWS_LIST.listed;
      out.set(e.slug, { label, tone: "listed" });
    } else if (notify.has(e.slug)) {
      out.set(e.slug, { label: SHOWS_LIST.notifyCard, tone: "listed" });
    } else {
      out.set(e.slug, { label: offLabel(e, todayIso), tone: "off" });
    }
  }
  return out;
}

function offLabel(e: EventEntry, todayIso: string): string {
  if (e.status === "canceled") return SHOWS_LIST.canceled;
  if (!isDisplayable(e)) return SHOWS_LIST.hidden;
  if (!e.isoDate) return SHOWS_LIST.undated;
  return e.isoDate < todayIso ? SHOWS_LIST.past : SHOWS_LIST.hidden;
}

/** Upcoming shows soonest first, then undated and past shows newest first. */
export function sortShows(list: EventEntry[], todayIso: string): EventEntry[] {
  const upcoming = (e: EventEntry) =>
    Boolean(e.isoDate && e.isoDate >= todayIso);
  return [...list].sort((a, b) => {
    const ua = upcoming(a);
    const ub = upcoming(b);
    if (ua !== ub) return ua ? -1 : 1;
    const da = a.isoDate ?? "";
    const db = b.isoDate ?? "";
    return ua ? da.localeCompare(db) : db.localeCompare(da);
  });
}
