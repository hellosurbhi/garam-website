import type { SubmitEvent } from "react";
import { COMING_SOON, EDITOR } from "@/data/adminShows";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import styles from "./ShowsTab.module.css";

interface ComingSoonAddFormProps {
  /** Cities not on the list yet. */
  choices: AdminCityOption[];
  slug: string;
  state: string;
  busy: boolean;
  onPick: (slug: string) => void;
  onState: (state: string) => void;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
}

/**
 * The city and state inputs that add a coming soon city. WHY the inputs are
 * disabled while a request is out: values typed meanwhile belong to the next
 * city, and the finished save used to clear them.
 */
export default function ComingSoonAddForm({
  choices,
  slug,
  state,
  busy,
  onPick,
  onState,
  onSubmit,
}: ComingSoonAddFormProps) {
  return (
    <form className={styles.addRow} onSubmit={onSubmit}>
      <label className={styles.label}>
        {COMING_SOON.cityLabel}
        <select
          className={styles.input}
          value={slug}
          disabled={busy}
          onChange={(e) => onPick(e.target.value)}
        >
          <option value="">{EDITOR.pickOne}</option>
          {choices.map((c) => (
            <option key={c.slug} value={c.slug}>
              {`${c.name}, ${c.region}`}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.label}>
        {COMING_SOON.stateLabel}
        <input
          className={styles.input}
          value={state}
          disabled={busy}
          onChange={(e) => onState(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className={styles.secondaryButton}
        disabled={busy || !slug}
      >
        {COMING_SOON.add}
      </button>
    </form>
  );
}
