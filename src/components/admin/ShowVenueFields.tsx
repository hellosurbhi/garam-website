import { EDITOR } from "@/data/adminShows";
import type { EventVenue } from "@/data/eventsSnapshot";
import type { FieldErrors } from "./showIssues";
import {
  venueToForm,
  type SetField,
  type ShowForm,
  type VenueForm,
} from "./showForm";
import ShowField from "./ShowField";

interface Props {
  form: ShowForm;
  set: SetField;
  errors: FieldErrors;
  venues: EventVenue[];
}

const VENUE_FIELDS: [keyof VenueForm, string][] = [
  ["name", EDITOR.venueName],
  ["streetAddress", EDITOR.venueStreet],
  ["addressLocality", EDITOR.venueLocality],
  ["addressRegion", EDITOR.venueRegion],
  ["postalCode", EDITOR.venuePostal],
  ["addressCountry", EDITOR.venueCountry],
];

/** Which saved venue the form matches, for the picker's value. */
function venueChoice(form: ShowForm, venues: EventVenue[]): string {
  if (!form.hasVenue) return "none";
  const at = venues.findIndex(
    (v) => JSON.stringify(venueToForm(v)) === JSON.stringify(form.venue),
  );
  return at === -1 ? "new" : String(at);
}

/** Venue picker plus the venue's address fields. */
export default function ShowVenueFields({ form, set, errors, venues }: Props) {
  function pickVenue(value: string) {
    set("hasVenue", value !== "none");
    if (value === "new") set("venue", venueToForm(undefined));
    else if (value !== "none") set("venue", venueToForm(venues[Number(value)]));
  }

  return (
    <>
      <ShowField id="show-venue" label={EDITOR.venue}>
        {(a) => (
          <select
            {...a}
            value={venueChoice(form, venues)}
            onChange={(e) => pickVenue(e.target.value)}
          >
            <option value="none">{EDITOR.venueNone}</option>
            {venues.map((v, i) => (
              <option
                key={`${v.name}|${v.addressLocality}`}
                value={i}
              >{`${v.name}, ${v.addressLocality}`}</option>
            ))}
            <option value="new">{EDITOR.venueNew}</option>
          </select>
        )}
      </ShowField>
      {form.hasVenue &&
        VENUE_FIELDS.map(([key, label]) => (
          <ShowField
            key={key}
            id={`show-venue-${key}`}
            label={label}
            error={errors[`venue.${key}`]}
          >
            {(a) => (
              <input
                {...a}
                value={form.venue[key]}
                onChange={(e) =>
                  set("venue", { ...form.venue, [key]: e.target.value })
                }
              />
            )}
          </ShowField>
        ))}
    </>
  );
}
