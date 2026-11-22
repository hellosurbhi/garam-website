import { SHOWS_ACTIONS, SHOWS_STATUS } from "@/data/adminShows";
import type { EventsAdminLoad } from "@/lib/eventsAdmin.server";
import { formatDay, type SitePhase } from "./showsView";
import styles from "./ShowsTab.module.css";

interface ShowsStatusProps {
  data: EventsAdminLoad;
  phase: SitePhase;
  lockMs: number;
  changeCount: number;
  rebuilding: boolean;
  busy: boolean;
  onRebuild: () => void;
}

function phaseText(phase: SitePhase): string {
  switch (phase.kind) {
    case "onSite":
      return SHOWS_STATUS.onSite;
    case "checking":
      return SHOWS_STATUS.checking;
    case "rebuilding":
      return SHOWS_STATUS.rebuilding(phase.minutes);
    case "stuck":
      return SHOWS_STATUS.stuck;
    case "notRequested":
      return SHOWS_STATUS.notRequested;
  }
}

const PHASE_TONE: Record<SitePhase["kind"], "ok" | "warn" | undefined> = {
  onSite: "ok",
  checking: undefined,
  rebuilding: undefined,
  stuck: "warn",
  notRequested: "warn",
};

/** Live version, draft state and whether the website has caught up (R15). */
export default function ShowsStatus({
  data,
  phase,
  lockMs,
  changeCount,
  rebuilding,
  busy,
  onRebuild,
}: ShowsStatusProps) {
  const { live, draft, history } = data;
  const author = history.find((h) => h.version === live.version)?.authorEmail;
  const locked = lockMs > 0;
  return (
    <section className={styles.section} aria-labelledby="shows-status-heading">
      <h2 id="shows-status-heading" className={styles.sectionHeading}>
        {SHOWS_STATUS.heading}
      </h2>
      <ul className={styles.statusLines}>
        <li>
          {SHOWS_STATUS.live(live.version, formatDay(live.publishedAt), author)}
        </li>
        <li
          className={styles.phase}
          data-tone={PHASE_TONE[phase.kind]}
          role="status"
        >
          {phaseText(phase)}
        </li>
        <li>
          {changeCount > 0
            ? SHOWS_STATUS.changes(changeCount)
            : SHOWS_STATUS.noChanges}
          {draft && changeCount > 0 && (
            <span className={styles.muted}>
              {" "}
              {SHOWS_STATUS.savedBy(
                draft.updatedBy,
                formatDay(draft.updatedAt),
              )}
            </span>
          )}
        </li>
        {locked && (
          <li className={styles.muted}>
            {SHOWS_STATUS.locked(Math.ceil(lockMs / 1000))}
          </li>
        )}
      </ul>
      <button
        type="button"
        className={styles.ghostButton}
        onClick={onRebuild}
        disabled={locked || busy}
      >
        {rebuilding ? SHOWS_ACTIONS.rebuilding : SHOWS_ACTIONS.rebuild}
      </button>
    </section>
  );
}
