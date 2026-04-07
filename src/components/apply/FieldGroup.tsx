import { useId } from "react";
import styles from "@/components/ApplyPage.module.css";

export function FieldGroup({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  return (
    <div
      className={styles.fieldGroup}
      {...(error ? { "data-error": "true" } : {})}
    >
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {required && <span className={styles.requiredMark}>*</span>}
      </label>
      {children}
      {error && (
        <p id={`${fieldId}-error`} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={[styles.sectionTitle, className].filter(Boolean).join(" ")}>
      {children}
    </h2>
  );
}
