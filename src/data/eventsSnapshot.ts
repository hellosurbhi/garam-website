/**
 * The one schema for show data (issue 337).
 *
 * The published show list is a snapshot `{ events, tbaCities }`. It is read
 * at build time (src/data/events.ts, from events.published.json), at runtime
 * and in the admin, and written only through the admin publish path. All of
 * them validate with the schemas below so they can never disagree.
 *
 * Two tiers (plan R12): the SHAPE tier checks types and formats and is used
 * on every read; historic records written before these rules existed pass it
 * untouched. The WRITE tier adds every business rule and applies only to
 * entries that are new or edited, so an untouched legacy record never blocks
 * a publish, while anything the owner edits must meet the full rules.
 */
// WHY: relative imports only. src/data/events.ts imports this module and is
// itself loaded by astro.config.mjs through Vite's config module runner,
// which does not apply the "@/" alias; any "@/" import anywhere in this
// graph fails `astro build`. test/events-config-safe.test.ts locks this in.
import { z } from "zod";
import { httpsUrlSchema } from "../lib/schemas";
import { buildEventRedirects, eventAliasDates } from "../utils/eventRedirects";
import { offsetForZone } from "../utils/timezone";
import { isSchemaEligible } from "./eventPredicates";
import { buildEventSlug } from "./eventSlug";
import { PERFORMER_IDS } from "./lineup";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
const EVENTBRITE_ID_PATTERN = /^\d+$/;
// WHY: event text reaches JSON-LD script tags; serializeJsonLd
// (src/utils/jsonLd.ts) already makes that safe at output. Rejecting angle
// brackets at input is defense in depth (plan R21): no show copy needs them.
const NO_ANGLE_BRACKETS = /^[^<>]*$/;
const ANGLE_BRACKET_MESSAGE = "Remove the < and > characters";

/** Hosts a ticket link may point at, by who sells the tickets. */
export const TICKET_URL_HOSTS = {
  eventbrite: ["www.eventbrite.com", "eventbrite.com"],
  /** Seeded presets for other-platform; any other https host is allowed. */
  otherPlatformPresets: ["tickets.citywinery.com", "www.dccomedyloft.com"],
  /** Never a checkout: scripts/check-server-runtime.mjs asserts redirects leave the site. */
  ownSite: "garammasaladating.com",
} as const;

export { buildEventSlug };

let timeZones: ReadonlySet<string> | undefined;

/** True for a canonical IANA zone id, e.g. "America/New_York". */
export function isValidTimeZone(timeZone: string): boolean {
  timeZones ??= new Set(Intl.supportedValuesOf("timeZone"));
  return timeZones.has(timeZone);
}

const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Card date label for an ISO date, e.g. "2026-02-22" -> "Feb 22". */
export function shortDateFromIso(isoDate: string): string {
  return shortDateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

const slugSchema = z.string().regex(SLUG_PATTERN, "Use a-z, 0-9 and -");
const isoDateSchema = z.iso.date();
const timeSchema = z.string().regex(TIME_PATTERN, "Use 24h HH:MM");

export const ticketSourceSchema = z.enum([
  "our-eventbrite",
  "their-eventbrite",
  "other-platform",
  "none",
]);

export const eventVenueSchema = z.object({
  name: z.string().min(1),
  streetAddress: z.string().optional(),
  addressLocality: z.string().min(1),
  addressRegion: z.string().min(1),
  postalCode: z.string().optional(),
  addressCountry: z.string().min(1),
});

const entryShapeFields = {
  date: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  stateAbbr: z.string().min(1),
  /** Stable slug matching a src/data/cities key (e.g. "manhattan"). */
  citySlug: slugSchema.optional(),
  /** Unique slug for this show's /events/[slug] page. Never changes. */
  slug: slugSchema,
  /** Overview copy for the per-event landing page. Never rendered as a price/CTA. */
  description: z.string(),
  /** Performers appearing on stage for this show. */
  lineup: z.array(z.enum(PERFORMER_IDS)),
  /** Who sells the tickets; see TicketSource. */
  ticketSource: ticketSourceSchema,
  // WHY "#" is accepted here: historic records may carry it and are never
  // rewritten (plan R12). The write tier rejects it.
  url: z.union([z.literal(""), z.literal("#"), httpsUrlSchema]),
  hidden: z.boolean().optional(),
  /** YYYY-MM-DD, present only for events with a specific date. */
  isoDate: isoDateSchema.optional(),
  /** HH:MM 24h, local to `timezone` (default "20:00"). */
  startTime: timeSchema.optional(),
  /** HH:MM 24h, local to `timezone` (default "22:00"). */
  endTime: timeSchema.optional(),
  venue: eventVenueSchema.optional(),
  /** USD amount, e.g. "15": JSON-LD offers.price only, never rendered in UI. */
  price: z.string().regex(PRICE_PATTERN).optional(),
  /** Machine-readable sold-out flag; do not use tagline for control flow. */
  soldOut: z.boolean().optional(),
  /** Short status line shown on the card (e.g. "Selling fast"). */
  tagline: z.string().optional(),
  /** Numeric Eventbrite event ID. */
  eventbriteId: z.string().regex(EVENTBRITE_ID_PATTERN).optional(),
  /** ISO 8601 UTC datetime; the card shows a pre-sale notify state until then. */
  onSaleAt: z.iso.datetime().optional(),
  /** IANA zone, e.g. "America/Chicago" (default "America/New_York"). */
  timezone: z.string().min(1).optional(),
  /** Canceled shows stay forever; isDisplayable() hides them everywhere. */
  status: z.literal("canceled").optional(),
  /** YYYY-MM-DD the show was originally scheduled for, set on reschedule. */
  previousDate: isoDateSchema.optional(),
  /** Additional former dates, retained across repeated reschedules. */
  previousDates: z.array(isoDateSchema).optional(),
  /** Human log note, e.g. "Canceled", "Moved from Aug 2". */
  note: z.string().optional(),
  /** ISO datetime of the last edit; feeds the sitemap lastmod. */
  updatedAt: z.iso.datetime().optional(),
};

/** Read tier: structure and formats only. Used on every snapshot read. */
export const eventEntryShapeSchema = z.object(entryShapeFields);

export const tbaCitySchema = z.object({
  city: z.string().min(1),
  state: z.string().min(1),
  stateAbbr: z.string().min(1),
  citySlug: slugSchema,
});

export const eventsSnapshotSchema = z.object({
  events: z.array(eventEntryShapeSchema),
  tbaCities: z.array(tbaCitySchema),
});

/** The file and Firestore pointer shape: `{ version, publishedAt, snapshot }`. */
export const publishedEnvelopeSchema = z.object({
  version: z.number().int().min(1),
  publishedAt: z.iso.datetime(),
  snapshot: eventsSnapshotSchema,
});

export type TicketSource = z.infer<typeof ticketSourceSchema>;
export type EventVenue = z.infer<typeof eventVenueSchema>;
export type EventEntry = z.infer<typeof eventEntryShapeSchema>;
export type TbaCity = z.infer<typeof tbaCitySchema>;
export type EventsSnapshot = z.infer<typeof eventsSnapshotSchema>;
export type PublishedEnvelope = z.infer<typeof publishedEnvelopeSchema>;

/**
 * The why-note every publish and restore carries (plan section 2). Shared so
 * the admin Shows tab refuses a blank note inline with the same rule the
 * publish and rollback routes enforce.
 */
export const publicationNoteSchema = z.string().trim().min(1).max(500);

/**
 * Publish, Restore and Rebuild wait this long after a rebuild request (R15).
 * Shared so the admin buttons unlock at the moment the routes stop refusing.
 */
export const REBUILD_DEBOUNCE_MS = 60_000;

/** A rebuild still not live after this long is reported as stuck (R10, R15). */
export const REBUILD_STUCK_MS = 20 * 60_000;

/** Validate an already JSON-parsed snapshot (read tier). Throws a ZodError. */
export function parseEventsSnapshot(value: unknown): EventsSnapshot {
  return eventsSnapshotSchema.parse(value);
}

// ── Write tier ───────────────────────────────────────────────────────────

function freeText(max: number) {
  return z.string().max(max).regex(NO_ANGLE_BRACKETS, ANGLE_BRACKET_MESSAGE);
}

function requiredText(max: number) {
  return freeText(max).min(1);
}

const venueWriteSchema = z.strictObject({
  name: requiredText(200),
  streetAddress: requiredText(200).optional(),
  addressLocality: requiredText(100),
  addressRegion: requiredText(100),
  postalCode: requiredText(20).optional(),
  addressCountry: requiredText(2),
});

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Why a ticket link is not allowed for its source, or undefined if it is. */
function ticketUrlIssue(source: TicketSource, url: string): string | undefined {
  if (source === "none") {
    return url === ""
      ? undefined
      : "Remove the ticket link, or pick who sells the tickets";
  }
  if (url === "") return "Add the ticket link";
  const host = new URL(url).hostname.toLowerCase();
  const isEventbrite = (
    TICKET_URL_HOSTS.eventbrite as readonly string[]
  ).includes(host);
  if (source === "our-eventbrite" || source === "their-eventbrite") {
    return isEventbrite ? undefined : "Use an eventbrite.com link";
  }
  if (hostMatches(host, TICKET_URL_HOSTS.ownSite)) {
    return "Link to the ticket seller, not to our own site";
  }
  if (isEventbrite) return "Eventbrite links need an Eventbrite ticket source";
  return undefined;
}

type WriteEntry = Omit<EventEntry, "citySlug" | "updatedAt"> & {
  citySlug: string;
  updatedAt: string;
};

function checkWriteRules(e: WriteEntry, ctx: z.RefinementCtx): void {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });

  if (e.isoDate) {
    if (e.date !== shortDateFromIso(e.isoDate)) {
      issue("date", `Date label must be "${shortDateFromIso(e.isoDate)}"`);
    }
    if (!e.timezone) issue("timezone", "Pick the show's time zone");
  } else {
    if (e.date !== "TBA") issue("date", 'Undated shows use "TBA"');
    // WHY: new "coming soon" cities belong in tbaCities; an undated entry
    // in events is only a legacy record that is hidden or canceled (R1).
    if (!e.hidden && e.status !== "canceled") {
      issue("isoDate", "Pick a date, or add the city to Coming soon cities");
    }
  }

  // WHY isSchemaEligible: buildEventSchemas throws at build time for these
  // entries without price/startTime/endTime; refusing them here means a
  // publish can never break the build.
  if (isSchemaEligible(e)) {
    if (!e.price) issue("price", "Add the ticket price");
    if (!e.startTime) issue("startTime", "Add the start time");
    if (!e.endTime) issue("endTime", "Add the end time");
  }

  const urlIssue = ticketUrlIssue(e.ticketSource, e.url);
  if (urlIssue) issue("url", urlIssue);

  if (e.ticketSource === "our-eventbrite" && !e.eventbriteId) {
    issue("eventbriteId", "Add the Eventbrite event id");
  }
  // WHY their-eventbrite may keep an id: promoter-run listings still have a
  // real public Eventbrite id (see TicketSource); only non-Eventbrite
  // sources can never have one.
  if (
    (e.ticketSource === "other-platform" || e.ticketSource === "none") &&
    e.eventbriteId
  ) {
    issue("eventbriteId", "Only Eventbrite shows have an Eventbrite id");
  }

  if (e.soldOut && !e.url) issue("soldOut", "A sold out show needs its link");
  if (e.status === "canceled" && !e.note) {
    issue("note", "Say why the show was canceled");
  }

  if (e.onSaleAt) {
    if (!e.isoDate || !e.startTime || !e.timezone) {
      issue("onSaleAt", "An on sale time needs the show date and start time");
    } else {
      const start = Date.parse(
        `${e.isoDate}T${e.startTime}:00${offsetForZone(e.isoDate, e.startTime, e.timezone)}`,
      );
      if (Date.parse(e.onSaleAt) >= start) {
        issue("onSaleAt", "Tickets must go on sale before the show starts");
      }
    }
  }
}

/** Write tier: every rule, for new or edited entries (R12). */
export const eventEntryWriteSchema = z
  .strictObject({
    ...entryShapeFields,
    date: requiredText(20),
    city: requiredText(100),
    state: requiredText(100),
    stateAbbr: requiredText(10),
    citySlug: slugSchema,
    description: requiredText(2000),
    lineup: z.array(z.enum(PERFORMER_IDS)).min(1),
    url: z.union([z.literal(""), httpsUrlSchema]),
    venue: venueWriteSchema.optional(),
    tagline: freeText(100).optional(),
    timezone: z
      .string()
      .refine(isValidTimeZone, "Pick a valid time zone")
      .optional(),
    note: freeText(1000).optional(),
    updatedAt: z.iso.datetime(),
  })
  // WHY `when`: zod 4 still runs an object's refinement after a field check
  // failed (unlike zod 3), so checkWriteRules would see e.g. url "#" or an
  // unknown zone and throw from new URL() or Intl. The rules assume valid
  // fields, so they run only once every field passed; field issues are
  // reported first, rule issues on the next attempt.
  .superRefine(checkWriteRules, {
    when: (payload) => payload.issues.length === 0,
  });

const tbaCityWriteSchema = z.strictObject({
  city: requiredText(100),
  state: requiredText(100),
  stateAbbr: requiredText(10),
  citySlug: slugSchema,
});

// ── Cross-version validation ─────────────────────────────────────────────

export interface SnapshotIssue {
  path: PropertyKey[];
  message: string;
}

export type SnapshotValidation =
  | { ok: true; snapshot: EventsSnapshot }
  | { ok: false; issues: SnapshotIssue[] };

export interface ValidateAgainstLiveOptions {
  // WHY passed in rather than imported: importing src/data/cities here
  // would pull every city page's data into every bundle that imports
  // events.ts (including the public apply page island). Required, so no
  // caller can skip the check by forgetting it.
  knownCitySlugs: ReadonlySet<string>;
  /** Set for a rollback: entries equal to the target version are trusted (R19). */
  rollbackTarget?: EventsSnapshot;
}

/** Fields a rollback rewrites on restored entries (R6, R14). */
const ROLLBACK_MANAGED_FIELDS = ["note", "previousDate", "previousDates"];

/** JSON with sorted keys and undefined dropped, for order-blind equality. */
function canonicalJson(value: unknown, omit: readonly string[] = []): string {
  return JSON.stringify(value, (key, v: unknown) => {
    if (omit.includes(key)) return undefined;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return v;
  });
}

function sameContent(
  a: unknown,
  b: unknown,
  omit: readonly string[] = [],
): boolean {
  return canonicalJson(a, omit) === canonicalJson(b, omit);
}

function eventAliases(e: EventEntry): string[] {
  return e.citySlug
    ? eventAliasDates(e).map((date) => `${e.citySlug}-${date}`)
    : [];
}

function appendNote(note: string | undefined, addition: string): string {
  return note ? `${note}; ${addition}` : addition;
}

const rawSnapshotSchema = z.object({
  events: z.array(z.unknown()),
  tbaCities: z.array(z.unknown()),
});

function zodIssues(
  error: z.ZodError,
  prefix: PropertyKey[] = [],
): SnapshotIssue[] {
  return error.issues.map((i) => ({
    path: [...prefix, ...i.path],
    message: i.message,
  }));
}

/**
 * Validate a candidate snapshot (draft save, publish or rollback) against
 * the live one. Cross-entry and cross-version rules apply to the whole
 * snapshot; the write tier applies only to new or edited entries.
 */
export function validateSnapshotAgainstLive(
  next: unknown,
  live: EventsSnapshot,
  options: ValidateAgainstLiveOptions,
): SnapshotValidation {
  const parsed = eventsSnapshotSchema.safeParse(next);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const snapshot = parsed.data;
  const raw = rawSnapshotSchema.parse(next);
  const issues: SnapshotIssue[] = [];

  const liveBySlug = new Map(live.events.map((e) => [e.slug, e]));
  const targetBySlug = new Map(
    (options.rollbackTarget?.events ?? []).map((e) => [e.slug, e]),
  );
  const tbaSlugs = new Set(snapshot.tbaCities.map((c) => c.citySlug));
  const nextSlugs = new Set(snapshot.events.map((e) => e.slug));

  // Unique slugs and alias conflicts: the same function the build uses.
  try {
    buildEventRedirects(snapshot.events);
  } catch (err) {
    issues.push({
      path: ["events"],
      message: err instanceof Error ? err.message : String(err),
    });
  }

  for (const slug of liveBySlug.keys()) {
    if (!nextSlugs.has(slug)) {
      issues.push({
        path: ["events"],
        message: `Show ${slug} cannot be removed. Cancel or hide it instead`,
      });
    }
  }

  snapshot.events.forEach((entry, i) => {
    const at = (field: string, message: string) =>
      issues.push({ path: ["events", i, field], message });
    const liveEntry = liveBySlug.get(entry.slug);

    if (liveEntry) {
      if (entry.citySlug !== liveEntry.citySlug) {
        at("citySlug", "The city of an existing show cannot change");
      }
      const kept = new Set(eventAliases(entry));
      for (const alias of eventAliases(liveEntry)) {
        if (!kept.has(alias)) {
          at("previousDates", `Keep the former date link ${alias}`);
        }
      }
      // WHY note must change too: a reschedule is logged on the entry
      // itself (src/data/CLAUDE.md); keeping the old note would leave the
      // move unexplained.
      if (
        entry.isoDate !== liveEntry.isoDate &&
        (!entry.note || entry.note === liveEntry.note)
      ) {
        at("note", "Say why the date changed");
      }
    }

    if (liveEntry && sameContent(entry, liveEntry)) return;
    const target = targetBySlug.get(entry.slug);
    if (target && sameContent(entry, target, ROLLBACK_MANAGED_FIELDS)) return;

    const strict = eventEntryWriteSchema.safeParse(raw.events[i]);
    if (!strict.success) issues.push(...zodIssues(strict.error, ["events", i]));
    if (
      entry.citySlug &&
      !options.knownCitySlugs.has(entry.citySlug) &&
      !tbaSlugs.has(entry.citySlug)
    ) {
      at("citySlug", `Unknown city ${entry.citySlug}`);
    }
    if (
      !liveEntry &&
      entry.citySlug &&
      entry.slug !== buildEventSlug(entry.citySlug, entry.isoDate)
    ) {
      at("slug", "A new show's link is built from its city and date");
    }
  });

  const seenTba = new Set<string>();
  snapshot.tbaCities.forEach((city, i) => {
    if (seenTba.has(city.citySlug)) {
      issues.push({
        path: ["tbaCities", i, "citySlug"],
        message: `${city.citySlug} is listed twice`,
      });
    }
    seenTba.add(city.citySlug);
    if (live.tbaCities.some((c) => sameContent(c, city))) return;
    const strict = tbaCityWriteSchema.safeParse(raw.tbaCities[i]);
    if (!strict.success) {
      issues.push(...zodIssues(strict.error, ["tbaCities", i]));
    }
    if (!options.knownCitySlugs.has(city.citySlug)) {
      issues.push({
        path: ["tbaCities", i, "citySlug"],
        message: `Unknown city ${city.citySlug}`,
      });
    }
  });

  return issues.length > 0 ? { ok: false, issues } : { ok: true, snapshot };
}

export interface SnapshotDiff {
  added: string[];
  changed: string[];
  canceled: string[];
  tbaCitiesAdded: string[];
  tbaCitiesRemoved: string[];
}

/** Slugs that differ between two snapshots, for the history and draft panels. */
export function diffSnapshots(
  prev: EventsSnapshot,
  next: EventsSnapshot,
): SnapshotDiff {
  const prevBySlug = new Map(prev.events.map((e) => [e.slug, e]));
  const diff: SnapshotDiff = {
    added: [],
    changed: [],
    canceled: [],
    tbaCitiesAdded: [],
    tbaCitiesRemoved: [],
  };
  for (const entry of next.events) {
    const before = prevBySlug.get(entry.slug);
    if (!before) diff.added.push(entry.slug);
    else if (entry.status === "canceled" && before.status !== "canceled") {
      diff.canceled.push(entry.slug);
    } else if (!sameContent(entry, before)) diff.changed.push(entry.slug);
  }
  const prevTba = new Set(prev.tbaCities.map((c) => c.citySlug));
  const nextTba = new Set(next.tbaCities.map((c) => c.citySlug));
  diff.tbaCitiesAdded = [...nextTba].filter((s) => !prevTba.has(s));
  diff.tbaCitiesRemoved = [...prevTba].filter((s) => !nextTba.has(s));
  return diff;
}

/**
 * The snapshot a rollback to version `k` publishes. Restores the target's
 * entries without ever losing what live has since gained:
 *  - a slug live has but the target lacks is kept, hidden and canceled
 *    (never-delete: its page may be indexed or shared);
 *  - every date link live has stays an alias of the restored entry (R6);
 *  - a restored entry whose date differs from live gets a note saying so
 *    (R14), because a date change always needs one.
 */
export function buildRollbackSnapshot(
  live: EventsSnapshot,
  target: EventsSnapshot,
  k: number,
  requestNote: string,
): EventsSnapshot {
  const liveBySlug = new Map(live.events.map((e) => [e.slug, e]));
  const targetSlugs = new Set(target.events.map((e) => e.slug));

  const restored = target.events.map((t): EventEntry => {
    const liveEntry = liveBySlug.get(t.slug);
    if (!liveEntry) return t;
    const entry: EventEntry = { ...t };
    const have = new Set(eventAliasDates(t));
    const extra = eventAliasDates(liveEntry).filter((d) => !have.has(d));
    if (extra.length > 0) {
      entry.previousDates = [...(t.previousDates ?? []), ...extra];
    }
    if (t.isoDate !== liveEntry.isoDate) {
      entry.note = appendNote(
        t.note,
        `Restored to ${t.isoDate ?? "TBA"} by rollback to v${k}: ${requestNote}`,
      );
    }
    return entry;
  });

  const carried = live.events
    .filter((e) => !targetSlugs.has(e.slug))
    .map((e): EventEntry => ({
      ...e,
      hidden: true,
      status: "canceled",
      note: appendNote(e.note, `Removed by rollback to v${k}: ${requestNote}`),
    }));

  return { events: [...restored, ...carried], tbaCities: target.tbaCities };
}
