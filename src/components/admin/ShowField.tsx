import type { ReactNode } from "react";
import { X } from "lucide-react";
import { EDITOR } from "@/data/adminShows";
import styles from "./ShowEditorModal.module.css";

/** Props every editor input spreads, so its label and error are announced. */
export interface FieldA11y {
  id: string;
  className: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

interface ShowFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (a11y: FieldA11y) => ReactNode;
}

/** One labelled editor input with its hint and inline error. */
export default function ShowField({
  id,
  label,
  error,
  hint,
  children,
}: ShowFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel} htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        className: styles.input,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface ShowCheckProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

/** A checkbox row with a 48px tap target and its inline error. */
export function ShowCheck({ label, checked, onChange, error }: ShowCheckProps) {
  return (
    <>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** The summary alert under the editor: what still blocks the save. */
export function ShowIssueSummary({ other }: { other: string[] }) {
  return (
    <div className={styles.errorMsg} role="alert">
      {other.length > 0 ? EDITOR.otherShows : EDITOR.fixFirst}
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
