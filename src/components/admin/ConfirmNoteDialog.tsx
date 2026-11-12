import { useState, type FormEvent, type ReactNode } from "react";
import { CONFIRM_DIALOG } from "@/data/adminShows";
import { publicationNoteSchema } from "@/data/eventsSnapshot";
import { Modal } from "../ui/Modal";
import styles from "./ShowEditorModal.module.css";

interface ConfirmNoteDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  /** Why the last attempt failed, shown inside the dialog. */
  error: string | null;
  /** Ask for the note the version history records (publish and restore). */
  askNote: boolean;
  /** What changes, shown between the body and the note. */
  children?: ReactNode;
  onConfirm: (note: string) => void;
  onClose: () => void;
}

/** One confirm step for publish, restore and discard. */
export default function ConfirmNoteDialog({
  title,
  body,
  confirmLabel,
  busyLabel,
  busy,
  error,
  askNote,
  children,
  onConfirm,
  onClose,
}: ConfirmNoteDialogProps) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!askNote) return onConfirm("");
    // The same rule the publish and rollback routes apply to the note.
    const parsed = publicationNoteSchema.safeParse(note);
    setNoteError(!parsed.success);
    if (parsed.success) onConfirm(parsed.data);
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabelledby="confirm-dialog-title"
      className={styles.dialogNarrow}
    >
      <form className={styles.body} onSubmit={submit} noValidate>
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.bodyText}>{body}</p>
        {children}
        {askNote && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="confirm-note">
              {CONFIRM_DIALOG.noteLabel}
            </label>
            <textarea
              id="confirm-note"
              className={styles.input}
              value={note}
              required
              maxLength={500}
              aria-invalid={noteError}
              aria-describedby={noteError ? "confirm-note-error" : undefined}
              onChange={(e) => setNote(e.target.value)}
            />
            {noteError && (
              <p
                id="confirm-note-error"
                className={styles.fieldError}
                role="alert"
              >
                {CONFIRM_DIALOG.noteRequired}
              </p>
            )}
          </div>
        )}
        {error && (
          <p className={styles.errorMsg} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            {CONFIRM_DIALOG.back}
          </button>
          <button type="submit" className={styles.submitButton} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
