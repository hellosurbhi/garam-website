// WHY: relative imports, not the "@/" alias, because eventRedirects.ts (which
// imports this file) is imported directly by astro.config.mjs, whose config
// loader does not apply the vite alias. Same constraint as events.ts. This file
// is also the ONE place that decides what "buyable now" means and how upcoming
// shows are ordered; every list on the site goes through sortUpcoming() so a
// placeholder date on a "tickets coming soon" card can never outrank a show
// people can actually buy (Austin/Houston/Dallas/etc. carry placeholder dates
// earlier than the real Philadelphia and SF shows; sorting by date alone put
// them first).
import { isDisplayable } from "./events";
import type { EventEntry } from "./events";

const DEFAULT_END_TIME = "22:00";
const DEFAULT_TIMEZONE = "America/New_York";

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return (
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    ) - utcMs
  );
}

/** UTC ms of a wall-clock moment (YYYY-MM-DD + HH:MM) in an IANA timezone. */
function zonedToUtcMs(isoDate: string, hhmm: string, timeZone: string): number {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes so a DST boundary between the guess and the answer is honored.
  const first = guess - tzOffsetMs(guess, timeZone);
  return guess - tzOffsetMs(first, timeZone);
}

/**
 * True once the show has ended, judged in the show's own timezone using its
 * endTime. A UTC date string gets this wrong: an SF show on Dec 26 evening is
 * already "Dec 27" in UTC while the show has not started. Shows with no
 * isoDate (TBA) are never over.
 */
export function isShowOver(e: EventEntry, nowMs: number): boolean {
  if (!e.isoDate) return false;
  const end = zonedToUtcMs(
    e.isoDate,
    e.endTime ?? DEFAULT_END_TIME,
    e.timezone ?? DEFAULT_TIMEZONE,
  );
  return nowMs >= end;
}

export function hasTicketLink(e: Pick<EventEntry, "url">): boolean {
  return !!e.url && e.url !== "#";
}

/** A displayable, not-over show with a real link that is on sale and not sold out. */
export function isBuyableNow(e: EventEntry, nowMs: number): boolean {
  if (!isDisplayable(e) || !e.isoDate || isShowOver(e, nowMs)) return false;
  if (!hasTicketLink(e) || e.soldOut) return false;
  if (e.onSaleAt && Date.parse(e.onSaleAt) > nowMs) return false;
  return true;
}

/** Displayable and either undated (TBA) or not yet over. */
export function isUpcoming(e: EventEntry, nowMs: number): boolean {
  return isDisplayable(e) && !isShowOver(e, nowMs);
}

/** 0 buyable now, 1 sold out or presale (has a link), 2 tickets coming soon. */
export function ticketTier(e: EventEntry, nowMs: number): 0 | 1 | 2 {
  if (isBuyableNow(e, nowMs)) return 0;
  if (hasTicketLink(e)) return 1;
  return 2;
}

/** Buyable first, then sold out or presale, then coming soon; soonest first, undated last. */
export function sortUpcoming(
  events: EventEntry[],
  nowMs: number,
): EventEntry[] {
  return events
    .map((e, i) => ({ e, i, tier: ticketTier(e, nowMs) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const ad = a.e.isoDate ?? "9999-99-99";
      const bd = b.e.isoDate ?? "9999-99-99";
      return ad === bd ? a.i - b.i : ad.localeCompare(bd);
    })
    .map((x) => x.e);
}
