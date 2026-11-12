import { useState, type FormEvent } from "react";
import { COMING_SOON, EDITOR } from "@/data/adminShows";
import {
  validateSnapshotAgainstLive,
  type EventsSnapshot,
  type TbaCity,
} from "@/data/eventsSnapshot";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import { splitIssues, toFieldIssues } from "./showIssues";
import type { ApiResult, FieldIssue } from "./showsApi";
import styles from "./ShowsTab.module.css";

interface ComingSoonCitiesProps {
  /** The draft being edited. */
  snapshot: EventsSnapshot;
  /** The live version, which the draft is validated against. */
  live: EventsSnapshot;
  cities: AdminCityOption[];
  busy: boolean;
  onSave: (snapshot: EventsSnapshot) => Promise<ApiResult<unknown> | null>;
}

/** The "notify me" cities with no booked date yet, with add and remove. */
export default function ComingSoonCities({
  snapshot,
  live,
  cities,
  busy,
  onSave,
}: ComingSoonCitiesProps) {
  const [slug, setSlug] = useState("");
  const [state, setState] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const listed = new Set(snapshot.tbaCities.map((c) => c.citySlug));
  const choices = cities.filter((c) => !listed.has(c.slug));

  function pick(next: string) {
    setSlug(next);
    const city = cities.find((c) => c.slug === next);
    // Prefill the full state name from any show already in that state.
    const known = [...snapshot.events, ...snapshot.tbaCities].find(
      (e) => e.stateAbbr === city?.region,
    );
    if (known) setState(known.state);
  }

  /** Checks with the server's rules first; true once the draft saved. */
  async function save(tbaCities: TbaCity[]): Promise<boolean> {
    const candidate = { ...snapshot, tbaCities };
    const describe = (issues: FieldIssue[]) =>
      splitIssues(issues, candidate, -1).other;
    const check = validateSnapshotAgainstLive(candidate, live, {
      knownCitySlugs: new Set(cities.map((c) => c.slug)),
    });
    if (!check.ok) {
      setProblems(describe(toFieldIssues(check.issues)));
      return false;
    }
    const res = await onSave(candidate);
    setProblems(res && !res.ok ? describe(res.issues) : []);
    return Boolean(res?.ok);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const city = cities.find((c) => c.slug === slug);
    if (!city) return;
    const entry: TbaCity = {
      city: city.name,
      state: state.trim(),
      stateAbbr: city.region,
      citySlug: city.slug,
    };
    if (!(await save([...snapshot.tbaCities, entry]))) return;
    setSlug("");
    setState("");
  }

  return (
    <section className={styles.section} aria-labelledby="coming-soon-heading">
      <h2 id="coming-soon-heading" className={styles.sectionHeading}>
        {COMING_SOON.heading}
      </h2>
      <p className={styles.muted}>{COMING_SOON.hint}</p>
      {snapshot.tbaCities.length === 0 ? (
        <p className={styles.emptyHint}>{COMING_SOON.empty}</p>
      ) : (
        <ul className={styles.rows}>
          {snapshot.tbaCities.map((c) => (
            <li key={c.citySlug} className={styles.row}>
              <span>{`${c.city}, ${c.stateAbbr}`}</span>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={busy}
                aria-label={COMING_SOON.removeLabel(c.city)}
                onClick={() =>
                  void save(snapshot.tbaCities.filter((t) => t !== c))
                }
              >
                {COMING_SOON.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {problems.length > 0 && (
        <div className={styles.errorMsg} role="alert">
          {problems.join(" ")}
        </div>
      )}
      <form className={styles.addRow} onSubmit={add}>
        <label className={styles.label}>
          {COMING_SOON.cityLabel}
          <select
            className={styles.input}
            value={slug}
            onChange={(e) => pick(e.target.value)}
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
            onChange={(e) => setState(e.target.value)}
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
    </section>
  );
}
