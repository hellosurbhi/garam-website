/**
 * The Shows editor form (issue 337): converts between a show record and the
 * flat strings the inputs hold, and applies the editing rules the record
 * itself cannot express (R6 reschedule history, R13 immutable slug and city,
 * R12 time zone prefill). Validation is NOT here: the editor runs the shared
 * validateSnapshotAgainstLive on the result, exactly as the server does.
 */
import { DEFAULT_LINEUP, type PerformerId } from "@/data/lineup";
import {
  appendNote,
  buildEventSlug,
  shortDateFromIso,
  type EventEntry,
  type EventsSnapshot,
  type EventVenue,
  type TicketSource,
} from "@/data/eventsSnapshot";
import * as venuePresets from "@/data/venues";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import { offsetForZone } from "@/utils/timezone";

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

/** US time zones for the picker, plus the show's own if it is elsewhere. */
export function timezoneChoices(current: string): string[] {
  const zones = Intl.supportedValuesOf("timeZone").filter((z) =>
    z.startsWith("America/"),
  );
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

/** "YYYY-MM-DDTHH:MM" wall clock in `timeZone` for a UTC instant. */
export function isoToLocal(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** UTC ISO instant for a wall clock in `timeZone`. */
export function localToIso(local: string, timeZone: string): string {
  const [date, time] = local.split("T");
  // WHY UTC when no zone is picked yet: the write tier then reports the
  // missing zone on both fields, so this value is never published.
  const offset = timeZone ? offsetForZone(date, time, timeZone) : "+00:00";
  return new Date(`${date}T${time}:00${offset}`).toISOString();
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

/** True when this edit needs a note: the show is newly canceled or moved (R6). */
export function noteRequired(form: ShowForm, base: EventEntry | undefined) {
  if (!base) return false;
  const moved = (base.isoDate ?? "") !== form.isoDate;
  return moved || (form.canceled && base.status !== "canceled");
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
 */
export function entryFromForm(
  form: ShowForm,
  base: EventEntry | undefined,
  nowIso: string,
): EventEntry {
  const isoDate = text(form.isoDate);
  const timezone = text(form.timezone);
  // WHY slug and city come from `base`: both are permanent once a show
  // exists (R13); its page and date links are built from them.
  const citySlug = base?.citySlug ?? form.citySlug;
  const keepOnSale =
    base?.onSaleAt &&
    isoToLocal(base.onSaleAt, timezone ?? "") === form.onSaleLocal;
  const note = text(form.note);
  // Empty fields become undefined, which JSON drops on the way to the server.
  return {
    ...base,
    ...(base ? rescheduleHistory(base, isoDate) : {}),
    city: base?.city ?? form.city.trim(),
    state: form.state.trim(),
    stateAbbr: form.stateAbbr.trim(),
    citySlug,
    slug: base?.slug ?? buildEventSlug(citySlug, isoDate),
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
    onSaleAt: keepOnSale
      ? base.onSaleAt
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
