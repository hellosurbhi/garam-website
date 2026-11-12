/**
 * The Shows editor form (issue 337): converts between a show record and the
 * flat strings the inputs hold, and applies the editing rules the record
 * itself cannot express (R6 reschedule history, R13 immutable slug and city,
 * R12 time zone prefill). Validation is NOT here: the editor runs the shared
 * validateSnapshotAgainstLive on the result, exactly as the server does.
 */
import { EDITOR } from "@/data/adminShows";
import { DEFAULT_LINEUP, type PerformerId } from "@/data/lineup";
import {
  appendNote,
  buildEventSlug,
  isoDateSchema,
  shortDateFromIso,
  type EventEntry,
  type EventsSnapshot,
  type EventVenue,
  type TicketSource,
} from "@/data/eventsSnapshot";
import * as venuePresets from "@/data/venues";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import { isoToLocal, isSkippedLocalTime, localToIso } from "@/utils/timezone";

export type VenueForm = Record<keyof EventVenue, string>;

/** Updates one form field; the editor passes it to every field group. */
export type SetField = <K extends keyof ShowForm>(
  key: K,
  value: ShowForm[K],
) => void;

export interface ShowForm {
  citySlug: string;
  city: string;
  state: string;
  stateAbbr: string;
  isoDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  hasVenue: boolean;
  venue: VenueForm;
  ticketSource: TicketSource;
  url: string;
  eventbriteId: string;
  price: string;
  /** "YYYY-MM-DDTHH:MM" in the show's own time zone. */
  onSaleLocal: string;
  soldOut: boolean;
  tagline: string;
  description: string;
  lineup: PerformerId[];
  hidden: boolean;
  canceled: boolean;
  /** Added to the record's note; the old note is kept. */
  note: string;
}

const EMPTY_VENUE: VenueForm = {
  name: "",
  streetAddress: "",
  addressLocality: "",
  addressRegion: "",
  postalCode: "",
  addressCountry: "US",
};

export function venueToForm(v: EventVenue | undefined): VenueForm {
  return { ...EMPTY_VENUE, ...v };
}

/** Saved venues: the presets, then any other venue a draft show uses. */
export function savedVenues(draftEvents: EventEntry[]): EventVenue[] {
  const all = [
    ...Object.values(venuePresets),
    ...draftEvents.flatMap((e) => (e.venue ? [e.venue] : [])),
  ];
  const seen = new Set<string>();
  return all.filter((v) => {
    const key = `${v.name}|${v.addressLocality}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The zone another show in the same city already uses (R12 prefill). */
export function cityTimezone(events: EventEntry[], citySlug: string): string {
  return (
    events.find((e) => e.citySlug === citySlug && e.timezone)?.timezone ?? ""
  );
}

/**
 * Every zone the browser knows, for a show touring anywhere, plus the
 * show's own if this browser's list lacks it (an older alias name).
 */
export function timezoneChoices(current: string): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

export function emptyForm(): ShowForm {
  return {
    citySlug: "",
    city: "",
    state: "",
    stateAbbr: "",
    isoDate: "",
    startTime: "20:00",
    endTime: "22:00",
    timezone: "",
    hasVenue: false,
    venue: venueToForm(undefined),
    ticketSource: "our-eventbrite",
    url: "",
    eventbriteId: "",
    price: "",
    onSaleLocal: "",
    soldOut: false,
    tagline: "",
    description: "",
    lineup: [...DEFAULT_LINEUP],
    hidden: false,
    canceled: false,
    note: "",
  };
}

export function formFromEntry(e: EventEntry, draft: EventEntry[]): ShowForm {
  const timezone = e.timezone ?? cityTimezone(draft, e.citySlug ?? "");
  return {
    citySlug: e.citySlug ?? "",
    city: e.city,
    state: e.state,
    stateAbbr: e.stateAbbr,
    isoDate: e.isoDate ?? "",
    startTime: e.startTime ?? "",
    endTime: e.endTime ?? "",
    timezone,
    hasVenue: Boolean(e.venue),
    venue: venueToForm(e.venue),
    ticketSource: e.ticketSource,
    url: e.url,
    eventbriteId: e.eventbriteId ?? "",
    price: e.price ?? "",
    onSaleLocal: e.onSaleAt ? isoToLocal(e.onSaleAt, timezone) : "",
    soldOut: Boolean(e.soldOut),
    tagline: e.tagline ?? "",
    description: e.description,
    lineup: [...e.lineup],
    hidden: Boolean(e.hidden),
    canceled: e.status === "canceled",
    note: "",
  };
}

/** True when `base` (the draft entry being edited) is on the live list. */
export function isPublished(
  base: EventEntry | undefined,
  live: EventsSnapshot,
): boolean {
  return Boolean(base && live.events.some((e) => e.slug === base.slug));
}

/**
 * True when this edit needs a note: the show is newly canceled, or a
 * published show moved (R6). A show never published has no public date to
 * explain, so it moves freely.
 */
export function noteRequired(
  form: ShowForm,
  base: EventEntry | undefined,
  published: boolean,
) {
  if (!base) return false;
  const moved = published && (base.isoDate ?? "") !== form.isoDate;
  return moved || (form.canceled && base.status !== "canceled");
}

// WHY untouched means "shows the saved instant in the current zone": a
// legacy show with no zone opened its on-sale time in UTC, and converting
// that clock in a newly picked zone shifted the instant (19:00Z to 23:00Z)
// although the admin never touched it. withTimezone re-renders an untouched
// time in the new zone, so what the field shows is what gets saved, and the
// exact saved value (seconds and a repeated fall back hour included) is
// kept instead of being rebuilt from the minute shown.
function keepsOnSale(form: ShowForm, base: EventEntry | undefined): boolean {
  return Boolean(
    base?.onSaleAt &&
    form.onSaleLocal === isoToLocal(base.onSaleAt, form.timezone),
  );
}

/**
 * Pick a new zone. An untouched on-sale time keeps its instant and is shown
 * as the new zone's clock; a typed one keeps the clock the admin typed,
 * which is then read in the new zone like the start and end times.
 */
export function withTimezone(
  form: ShowForm,
  timezone: string,
  base: EventEntry | undefined,
): ShowForm {
  const onSaleLocal =
    base?.onSaleAt && keepsOnSale(form, base)
      ? isoToLocal(base.onSaleAt, timezone)
      : form.onSaleLocal;
  return { ...form, timezone, onSaleLocal };
}

const LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export interface FormDateProblem {
  /** The record field the problem belongs to, as the validator names it. */
  field: "isoDate" | "startTime" | "endTime" | "onSaleAt";
  message: string;
}

/** A show time as one wall clock in its zone, or "" when a part is missing. */
function wallClock(form: ShowForm, key: "startTime" | "endTime"): string {
  return form.isoDate && form.timezone && TIME_PATTERN.test(form[key])
    ? `${form.isoDate}T${form[key]}`
    : "";
}

/**
 * Date problems entryFromForm cannot survive, found before it runs: a year
 * past 9999 makes Date throw RangeError, and a wall clock the zone skips
 * at spring forward would silently become another time. Only edited times
 * are checked, so a saved show still opens and saves as it was.
 */
export function formDateProblems(
  form: ShowForm,
  base: EventEntry | undefined,
  initial: ShowForm | undefined,
): FormDateProblem[] {
  const problems: FormDateProblem[] = [];
  if (form.isoDate && !isoDateSchema.safeParse(form.isoDate).success) {
    return [{ field: "isoDate", message: EDITOR.badDate }];
  }
  for (const key of ["startTime", "endTime"] as const) {
    const clock = wallClock(form, key);
    const before = initial ? wallClock(initial, key) : "";
    const edited = clock !== before || form.timezone !== initial?.timezone;
    if (clock && edited && isSkippedLocalTime(clock, form.timezone)) {
      problems.push({ field: key, message: EDITOR.skippedTime });
    }
  }
  const local = form.onSaleLocal;
  if (!local || keepsOnSale(form, base)) return problems;
  const day = LOCAL_PATTERN.exec(local)?.[1];
  if (!day || !isoDateSchema.safeParse(day).success) {
    problems.push({ field: "onSaleAt", message: EDITOR.badDate });
  } else if (form.timezone && isSkippedLocalTime(local, form.timezone)) {
    problems.push({ field: "onSaleAt", message: EDITOR.skippedTime });
  }
  return problems;
}

function text(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function venueFromForm(v: VenueForm): EventVenue {
  return {
    name: v.name.trim(),
    streetAddress: text(v.streetAddress),
    addressLocality: v.addressLocality.trim(),
    addressRegion: v.addressRegion.trim(),
    postalCode: text(v.postalCode),
    addressCountry: v.addressCountry.trim(),
  };
}

/** Former dates after a move from `base.isoDate` (R6: never overwrite one). */
function rescheduleHistory(base: EventEntry, isoDate: string | undefined) {
  const old = base.isoDate;
  if (!old || old === isoDate) return {};
  if (!base.previousDate) return { previousDate: old };
  const kept = base.previousDates ?? [];
  if (base.previousDate === old || kept.includes(old)) return {};
  return { previousDates: [...kept, old] };
}

/**
 * The record the form describes. `base` is the draft entry being edited
 * (undefined for a new show); fields the form does not show are kept.
 * `published` says whether `base` is on the live list. Run formDateProblems first: an
 * impossible date throws here.
 */
export function entryFromForm(
  form: ShowForm,
  base: EventEntry | undefined,
  nowIso: string,
  published: boolean,
): EventEntry {
  const isoDate = text(form.isoDate);
  const timezone = text(form.timezone);
  // The editor locks the city once a show exists (R13).
  const citySlug = base?.citySlug ?? form.citySlug;
  // WHY only a published show keeps its slug and logs former dates: its
  // page and date links are public and permanent (R13, src/data/CLAUDE.md).
  // A draft only show has no public link yet, and the validator requires
  // a new show's slug to match its city and date, so it is rebuilt.
  const kept = published && base;
  const note = text(form.note);
  // Empty fields become undefined, which JSON drops on the way to the server.
  return {
    ...base,
    ...(kept ? rescheduleHistory(kept, isoDate) : {}),
    city: base?.city ?? form.city.trim(),
    state: form.state.trim(),
    stateAbbr: form.stateAbbr.trim(),
    citySlug,
    slug: kept ? kept.slug : buildEventSlug(citySlug, isoDate),
    date: isoDate ? shortDateFromIso(isoDate) : "TBA",
    isoDate,
    startTime: text(form.startTime),
    endTime: text(form.endTime),
    timezone,
    venue: form.hasVenue ? venueFromForm(form.venue) : undefined,
    ticketSource: form.ticketSource,
    url: form.url.trim(),
    eventbriteId: text(form.eventbriteId),
    price: text(form.price),
    onSaleAt: keepsOnSale(form, base)
      ? base?.onSaleAt
      : form.onSaleLocal
        ? localToIso(form.onSaleLocal, timezone ?? "")
        : undefined,
    soldOut: form.soldOut || undefined,
    tagline: text(form.tagline),
    description: form.description.trim(),
    lineup: form.lineup,
    hidden: form.hidden || undefined,
    status: form.canceled ? "canceled" : undefined,
    note: note ? appendNote(base?.note, note) : base?.note,
    updatedAt: nowIso,
  };
}

/**
 * The form after picking a city for a new show: name and state code from
 * the city page, the full state name and time zone from any show or coming
 * soon card already in that state or city (R12 prefill).
 */
export function withCity(
  form: ShowForm,
  city: AdminCityOption,
  snapshot: EventsSnapshot,
): ShowForm {
  const sameState = [...snapshot.events, ...snapshot.tbaCities].find(
    (e) => e.stateAbbr === city.region,
  );
  return {
    ...form,
    citySlug: city.slug,
    city: city.name,
    stateAbbr: city.region,
    state: sameState?.state ?? form.state,
    timezone: cityTimezone(snapshot.events, city.slug) || form.timezone,
  };
}
