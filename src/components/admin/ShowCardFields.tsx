import { EDITOR } from "@/data/adminShows";
import { PERFORMER_IDS, PERFORMERS, type PerformerId } from "@/data/lineup";
import type { FieldErrors } from "./showIssues";
import type { SetField, ShowForm } from "./showForm";
import ShowField, { ShowCheck } from "./ShowField";
import styles from "./ShowEditorModal.module.css";

interface Props {
  form: ShowForm;
  set: SetField;
  errors: FieldErrors;
  noteNeeded: boolean;
}

/** The "On the card" and "Status" parts of the Shows editor. */
export default function ShowCardFields({
  form,
  set,
  errors,
  noteNeeded,
}: Props) {
  function toggleLineup(id: PerformerId, on: boolean) {
    const next = on
      ? [...form.lineup, id]
      : form.lineup.filter((p) => p !== id);
    // Keep the published order (Surbhi, then Wyatt) whatever the click order.
    set(
      "lineup",
      PERFORMER_IDS.filter((p) => next.includes(p)),
    );
  }

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{EDITOR.sectionCard}</legend>
        <ShowField
          id="show-tagline"
          label={EDITOR.tagline}
          error={errors.tagline}
        >
          {(a) => (
            <input
              {...a}
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
            />
          )}
        </ShowField>
        <ShowField
          id="show-description"
          label={EDITOR.description}
          error={errors.description}
        >
          {(a) => (
            <textarea
              {...a}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          )}
        </ShowField>
        <div
          role="group"
          aria-label={EDITOR.lineup}
          className={styles.formGroup}
        >
          <span className={styles.formLabel}>{EDITOR.lineup}</span>
          <div className={styles.checkGroup}>
            {PERFORMER_IDS.map((id) => (
              <ShowCheck
                key={id}
                id={`show-lineup-${id}`}
                label={PERFORMERS[id].name}
                checked={form.lineup.includes(id)}
                onChange={(v) => toggleLineup(id, v)}
              />
            ))}
          </div>
          {errors.lineup && (
            <p className={styles.fieldError} role="alert">
              {errors.lineup}
            </p>
          )}
        </div>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{EDITOR.sectionStatus}</legend>
        <ShowCheck
          id="show-hidden"
          label={EDITOR.hidden}
          checked={form.hidden}
          onChange={(v) => set("hidden", v)}
        />
        <ShowCheck
          id="show-canceled"
          label={EDITOR.canceled}
          checked={form.canceled}
          onChange={(v) => set("canceled", v)}
        />
        <ShowField
          id="show-note"
          label={EDITOR.note}
          error={errors.note}
          hint={EDITOR.noteHint}
        >
          {(a) => (
            <textarea
              {...a}
              required={noteNeeded}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          )}
        </ShowField>
      </fieldset>
    </>
  );
}
