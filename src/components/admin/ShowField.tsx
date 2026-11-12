import type { ReactNode } from "react";
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
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

/** A checkbox row with a 48px tap target and its inline error. */
export function ShowCheck({
  id,
  label,
  checked,
  onChange,
  error,
}: ShowCheckProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <>
      <label className={styles.check}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
