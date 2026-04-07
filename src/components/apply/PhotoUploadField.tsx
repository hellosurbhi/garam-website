import { type ChangeEvent } from "react";
import styles from "@/components/ApplyPage.module.css";

interface PhotoUploadFieldProps {
  photoPreview: string | null;
  error?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function PhotoUploadField({
  photoPreview,
  error,
  onChange,
}: PhotoUploadFieldProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Photo</h2>
      <p className={styles.photoLabel}>
        Best recent photo
        <span className={styles.requiredMark}>*</span>
      </p>

      <input
        id="photo-input"
        type="file"
        accept="image/*"
        onChange={onChange}
        className={styles.hiddenInput}
      />

      <label
        htmlFor="photo-input"
        className={error ? styles.photoDropzoneError : styles.photoDropzone}
      >
        {photoPreview ? (
          <img
            src={photoPreview}
            alt="Photo preview"
            className={styles.photoPreview}
            loading="lazy"
            width={200}
            height={200}
          />
        ) : (
          <>
            <p className={styles.photoEmoji}>📸</p>
            <p className={styles.photoPrompt}>Tap to upload a photo</p>
          </>
        )}
      </label>

      {photoPreview && (
        <label htmlFor="photo-input" className={styles.changePhoto}>
          Change photo
        </label>
      )}

      {error && (
        <p className={styles.photoError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
