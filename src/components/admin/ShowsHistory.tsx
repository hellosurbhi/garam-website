import { HISTORY } from "@/data/adminShows";
import type { EventVersionSummary } from "@/lib/eventsStore.server";
import { countChanges, formatDay } from "./showsView";
import styles from "./ShowsTab.module.css";

interface ShowsHistoryProps {
  history: EventVersionSummary[];
  liveVersion: number;
  /** Restore is off while a rebuild just started (R15) or a request runs. */
  disabled: boolean;
  onRestore: (version: number) => void;
}

function kindLabel(v: EventVersionSummary): string {
  if (v.kind === "migration") return HISTORY.kindMigration;
  if (v.kind === "rollback") return HISTORY.kindRollback(v.restoresVersion);
  return HISTORY.kindPublish;
}

/** Recent published versions, newest first, each restorable. */
export default function ShowsHistory({
  history,
  liveVersion,
  disabled,
  onRestore,
}: ShowsHistoryProps) {
  return (
    <section className={styles.section} aria-labelledby="shows-history-heading">
      <h2 id="shows-history-heading" className={styles.sectionHeading}>
        {HISTORY.heading}
      </h2>
      {history.length === 0 ? (
        <p className={styles.emptyHint}>{HISTORY.empty}</p>
      ) : (
        <ul className={styles.rows}>
          {history.map((v) => (
            <li key={v.version} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>
                  {HISTORY.version(v.version)}
                  {v.version === liveVersion && (
                    <span className={styles.pill} data-tone="listed">
                      {HISTORY.liveBadge}
                    </span>
                  )}
                </span>
                <span className={styles.muted}>
                  {HISTORY.byLine(
                    kindLabel(v),
                    v.authorEmail,
                    formatDay(v.createdAt),
                  )}
                  {`. ${HISTORY.changeCount(countChanges(v.changes))}`}
                </span>
                <span>{v.note}</span>
              </span>
              {v.version < liveVersion && (
                <button
                  type="button"
                  className={styles.ghostButton}
                  disabled={disabled}
                  aria-label={HISTORY.restoreLabel(v.version)}
                  onClick={() => onRestore(v.version)}
                >
                  {HISTORY.restore}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
