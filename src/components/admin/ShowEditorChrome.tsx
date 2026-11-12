/** The Shows editor's frame: title row, problem summary and actions. */
import { X } from "lucide-react";
import { EDITOR } from "@/data/adminShows";
import styles from "./ShowEditorModal.module.css";

/**
 * The summary alert under the editor: what still blocks the save, or why
 * the save failed when the server sent no field problems.
 */
export function ShowIssueSummary({
  other,
  failure,
}: {
  other: string[];
  failure: string | null;
}) {
  return (
    <div className={styles.errorMsg} role="alert">
      {failure ?? (other.length > 0 ? EDITOR.otherShows : EDITOR.fixFirst)}
      {other.length > 0 && (
        <ul className={styles.errorList}>
          {other.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The editor's title row with its close button. */
export function ShowEditorHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.header}>
      <h2 id="show-editor-title" className={styles.title}>
        {title}
      </h2>
      <button
        type="button"
        className={styles.closeButton}
        onClick={onClose}
        aria-label={EDITOR.close}
      >
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Close and Save at the foot of the editor form. */
export function ShowEditorActions({
  saving,
  onClose,
}: {
  saving: boolean;
  onClose: () => void;
}) {
  return (
    <div className={styles.actionRow}>
      <button type="button" className={styles.cancelButton} onClick={onClose}>
        {EDITOR.close}
      </button>
      <button type="submit" className={styles.submitButton} disabled={saving}>
        {saving ? EDITOR.saving : EDITOR.save}
      </button>
    </div>
  );
}
