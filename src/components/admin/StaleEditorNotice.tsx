import { EDITOR } from "@/data/adminShows";
import styles from "./ShowsTab.module.css";

/** Shown in place of an editor whose show list was replaced by a reload. */
export default function StaleEditorNotice({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div className={styles.errorMsg} role="alert">
      <p>{EDITOR.stale}</p>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onDismiss}
      >
        {EDITOR.staleDismiss}
      </button>
    </div>
  );
}
