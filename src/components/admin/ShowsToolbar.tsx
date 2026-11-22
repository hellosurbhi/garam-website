import { SHOWS_ACTIONS } from "@/data/adminShows";
import styles from "./ShowsTab.module.css";

interface ShowsToolbarProps {
  busy: boolean;
  /** A rebuild just started, so publishing waits (R15). */
  locked: boolean;
  changeCount: number;
  historyOpen: boolean;
  onAdd: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onToggleHistory: () => void;
}

/** The tab's main actions: add, publish, discard and the history toggle. */
export default function ShowsToolbar({
  busy,
  locked,
  changeCount,
  historyOpen,
  onAdd,
  onPublish,
  onDiscard,
  onToggleHistory,
}: ShowsToolbarProps) {
  const nothingToPublish = changeCount === 0;
  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.primaryButton}
        disabled={busy}
        onClick={onAdd}
      >
        {SHOWS_ACTIONS.addShow}
      </button>
      <button
        type="button"
        className={styles.secondaryButton}
        disabled={busy || locked || nothingToPublish}
        onClick={onPublish}
      >
        {SHOWS_ACTIONS.publish}
      </button>
      <button
        type="button"
        className={styles.ghostButton}
        disabled={busy || nothingToPublish}
        onClick={onDiscard}
      >
        {SHOWS_ACTIONS.discard}
      </button>
      <button
        type="button"
        className={styles.ghostButton}
        aria-expanded={historyOpen}
        onClick={onToggleHistory}
      >
        {historyOpen ? SHOWS_ACTIONS.hideHistory : SHOWS_ACTIONS.history}
      </button>
    </div>
  );
}
