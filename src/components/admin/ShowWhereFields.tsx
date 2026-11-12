import { EDITOR } from "@/data/adminShows";
import type { EventVenue } from "@/data/eventsSnapshot";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import type { FieldErrors } from "./showIssues";
import { timezoneChoices, type SetField, type ShowForm } from "./showForm";
import ShowField from "./ShowField";
import ShowVenueFields from "./ShowVenueFields";
import styles from "./ShowEditorModal.module.css";

interface Props {
  form: ShowForm;
  set: SetField;
  errors: FieldErrors;
  /** False for a published show: its city is permanent (R13). */
  cityEditable: boolean;
  cities: AdminCityOption[];
  onPickCity: (city: AdminCityOption) => void;
  /** A new zone also re-renders an untouched on-sale time (withTimezone). */
  onPickZone: (timezone: string) => void;
  venues: EventVenue[];
}

/** The "When and where" part of the Shows editor. */
export default function ShowWhereFields({
  form,
  set,
  errors,
  cityEditable,
  cities,
  onPickCity,
  onPickZone,
  venues,
}: Props) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{EDITOR.sectionWhere}</legend>
      <ShowField
        id="show-city"
        label={EDITOR.city}
        error={errors.citySlug}
        hint={cityEditable ? undefined : EDITOR.cityLocked}
      >
        {(a) =>
          cityEditable ? (
            <select
              {...a}
              value={form.citySlug}
              onChange={(e) => {
                const city = cities.find((c) => c.slug === e.target.value);
                if (city) onPickCity(city);
              }}
            >
              <option value="">{EDITOR.pickOne}</option>
              {cities.map((c) => (
                <option
                  key={c.slug}
                  value={c.slug}
                >{`${c.name}, ${c.region}`}</option>
              ))}
            </select>
          ) : (
            <input {...a} value={`${form.city}, ${form.stateAbbr}`} readOnly />
          )
        }
      </ShowField>
      <div className={styles.pair}>
        <ShowField id="show-state" label={EDITOR.state} error={errors.state}>
          {(a) => (
            <input
              {...a}
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
            />
          )}
        </ShowField>
        <ShowField
          id="show-state-abbr"
          label={EDITOR.stateAbbr}
          error={errors.stateAbbr}
        >
          {(a) => (
            <input
              {...a}
              value={form.stateAbbr}
              onChange={(e) => set("stateAbbr", e.target.value)}
            />
          )}
        </ShowField>
      </div>
      <ShowField id="show-date" label={EDITOR.date} error={errors.isoDate}>
        {(a) => (
          <input
            {...a}
            type="date"
            value={form.isoDate}
            onChange={(e) => set("isoDate", e.target.value)}
          />
        )}
      </ShowField>
      <div className={styles.pair}>
        <ShowField
          id="show-start"
          label={EDITOR.startTime}
          error={errors.startTime}
        >
          {(a) => (
            <input
              {...a}
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
            />
          )}
        </ShowField>
        <ShowField id="show-end" label={EDITOR.endTime} error={errors.endTime}>
          {(a) => (
            <input
              {...a}
              type="time"
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
            />
          )}
        </ShowField>
      </div>
      <ShowField
        id="show-timezone"
        label={EDITOR.timezone}
        error={errors.timezone}
      >
        {(a) => (
          <select
            {...a}
            value={form.timezone}
            onChange={(e) => onPickZone(e.target.value)}
          >
            <option value="">{EDITOR.pickOne}</option>
            {timezoneChoices(form.timezone).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        )}
      </ShowField>
      <ShowVenueFields form={form} set={set} errors={errors} venues={venues} />
    </fieldset>
  );
}
