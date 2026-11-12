/**
 * Turns validation issues (from the shared validator in the browser, or
 * from the draft route) into the inline errors the Shows editor shows.
 * Both sources use the same "events.3.url" paths, so one mapping serves
 * both and the owner sees the same message wherever it was caught.
 */
import { EDITOR } from "@/data/adminShows";
import {
  validateSnapshotAgainstLive,
  type EventEntry,
  type EventsSnapshot,
  type SnapshotIssue,
} from "@/data/eventsSnapshot";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import { entryFromForm, noteRequired, type ShowForm } from "./showForm";
import type { FieldIssue } from "./showsApi";
import { showName } from "./showsView";

/** Inline errors keyed by form field, e.g. "url" or "venue.name". */
export type FieldErrors = Partial<Record<string, string>>;

export function toFieldIssues(issues: SnapshotIssue[]): FieldIssue[] {
  return issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
}

// WHY a rename table: the record stores some values the form edits under
// another name (the "Jan 9" label is derived from the date input, the
// on sale instant from a local time input, the slug from city and date).
const FIELD_FOR_ISSUE: Record<string, string> = {
  date: "isoDate",
  slug: "isoDate",
  onSaleAt: "onSaleLocal",
  city: "citySlug",
  venue: "venue.name",
};

/** Form fields the editor renders an error slot for. */
export const EDITOR_FIELDS = new Set([
  "citySlug",
  "state",
  "stateAbbr",
  "isoDate",
  "startTime",
  "endTime",
  "timezone",
  "venue.name",
  "venue.streetAddress",
  "venue.addressLocality",
  "venue.addressRegion",
  "venue.postalCode",
  "venue.addressCountry",
  "ticketSource",
  "url",
  "eventbriteId",
  "price",
  "onSaleLocal",
  "soldOut",
  "tagline",
  "description",
  "lineup",
  "note",
]);

export interface SplitIssues {
  fields: FieldErrors;
  /** Problems the editor has no input for, already worded for the owner. */
  other: string[];
}

/** Errors for the show at `index`, and everything else as plain lines. */
export function splitIssues(
  issues: FieldIssue[],
  snapshot: EventsSnapshot,
  index: number,
): SplitIssues {
  const prefix = `events.${index}.`;
  const fields: FieldErrors = {};
  const other: string[] = [];
  for (const issue of issues) {
    if (issue.path.startsWith(prefix)) {
      const key = issue.path.slice(prefix.length);
      const field = FIELD_FOR_ISSUE[key] ?? key;
      if (EDITOR_FIELDS.has(field)) {
        fields[field] ??= issue.message;
        continue;
      }
    }
    other.push(describe(issue, snapshot));
  }
  return { fields, other };
}

function describe(issue: FieldIssue, snapshot: EventsSnapshot): string {
  const [list, index] = issue.path.split(".");
  const item =
    list === "events"
      ? snapshot.events[Number(index)]
      : list === "tbaCities"
        ? snapshot.tbaCities[Number(index)]
        : undefined;
  if (!item) return issue.message;
  const name = "date" in item ? showName(item) : item.city;
  return `${name}: ${issue.message}`;
}

export interface ShowFormCheckInput {
  form: ShowForm;
  /** The saved show being edited; undefined when adding one. */
  base: EventEntry | undefined;
  /** Where the show sits (or will sit) in the draft's events. */
  index: number;
  snapshot: EventsSnapshot;
  live: EventsSnapshot;
  cities: AdminCityOption[];
  nowIso: string;
}

/**
 * The draft with this show saved, checked with the same validator the
 * draft route runs, plus the note rule the form asks for up front.
 */
export function checkShowForm(input: ShowFormCheckInput): {
  candidate: EventsSnapshot;
  problems: FieldIssue[];
} {
  const { form, base, index, snapshot, live } = input;
  const entry = entryFromForm(form, base, input.nowIso);
  const events = base
    ? snapshot.events.map((x, i) => (i === index ? entry : x))
    : [...snapshot.events, entry];
  const candidate: EventsSnapshot = { ...snapshot, events };
  const check = validateSnapshotAgainstLive(candidate, live, {
    knownCitySlugs: new Set(input.cities.map((c) => c.slug)),
  });
  const problems = check.ok ? [] : toFieldIssues(check.issues);
  if (noteRequired(form, base) && !form.note.trim()) {
    problems.push({ path: `events.${index}.note`, message: EDITOR.noteNeeded });
  }
  return { candidate, problems };
}
