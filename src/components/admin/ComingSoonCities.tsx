import { useState, type SubmitEvent } from "react";
import { COMING_SOON } from "@/data/adminShows";
import {
  validateSnapshotAgainstLive,
  type EventsSnapshot,
  type TbaCity,
} from "@/data/eventsSnapshot";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import ComingSoonAddForm from "./ComingSoonAddForm";
import { splitIssues, toFieldIssues } from "./showIssues";
import { failureMessage, type ApiResult, type FieldIssue } from "./showsApi";
import styles from "./ShowsTab.module.css";

interface ComingSoonCitiesProps {
  /** The draft being edited. */
  snapshot: EventsSnapshot;
  /** The live version, which the draft is validated against. */
  live: EventsSnapshot;
  cities: AdminCityOption[];
  /** Cities /tickets gives a Notify Me card, chosen by waitlist demand. */
  notifyCities: string[];
  busy: boolean;
  onSave: (snapshot: EventsSnapshot) => Promise<ApiResult<unknown> | null>;
}

/**
 * Coming soon cities, with add and remove. WHY the read only Notify Me
 * line: since #361 those cards follow waitlist demand, not this list, so
 * the section says which cities have one instead of implying it controls them.
 */
export default function ComingSoonCities({
  snapshot,
  live,
  cities,
  notifyCities,
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
    const failed = failureMessage(res);
    const issues = res && !res.ok ? res.issues : [];
    setProblems(issues.length > 0 ? describe(issues) : failed ? [failed] : []);
    return Boolean(res?.ok);
  }

  async function add(e: SubmitEvent<HTMLFormElement>) {
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
      <p className={styles.muted}>
        {notifyCities.length > 0
          ? COMING_SOON.notifyNow(notifyCities)
          : COMING_SOON.notifyNone}
      </p>
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
      <ComingSoonAddForm
        choices={choices}
        slug={slug}
        state={state}
        busy={busy}
        onPick={pick}
        onState={setState}
        onSubmit={add}
      />
    </section>
  );
}
