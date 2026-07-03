import { type ChangeEvent } from "react";
import { APPLY_PAGE } from "@/data/copy";
import styles from "@/components/ApplyPage.module.css";

interface PhotoUploadFieldProps {
  photoPreviews: string[];
  error?: string;
  onAddPhotos: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
}

const MAX_PHOTOS = 10;

export function PhotoUploadField({
  photoPreviews,
  error,
  onAddPhotos,
  onRemovePhoto,
}: PhotoUploadFieldProps) {
  const canAddMore = photoPreviews.length < MAX_PHOTOS;

  return (
    <div
      className={styles.section}
      {...(error ? { "data-error": "true" } : {})}
    >
      <h2 className={styles.sectionTitle}>Photos</h2>

      <div className={styles.photoGuidance}>
        <p className={styles.photoGuidanceHeading}>
          {APPLY_PAGE.photoGuidanceHeading}
        </p>
        <p className={styles.photoGuidanceIntro}>
          {APPLY_PAGE.photoGuidanceIntro}
        </p>
        <ul className={styles.photoGuidanceList}>
          {APPLY_PAGE.photoGuidanceItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.photoGuidanceFooter}>
          {APPLY_PAGE.photoGuidanceFooter}
        </p>
      </div>

      <p className={styles.photoLabel}>
        {photoPreviews.length === 0
          ? "Add at least one photo"
          : `${photoPreviews.length} of ${MAX_PHOTOS} photos added`}
        <span className={styles.requiredMark}>*</span>
      </p>

      <div className={styles.photoGrid}>
        {photoPreviews.map((src, i) => (
          <div key={src + i} className={styles.photoThumbWrapper}>
            <img
              src={src}
              alt={`Photo ${i + 1} preview`}
              className={styles.photoThumbImg}
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => onRemovePhoto(i)}
              className={styles.photoRemoveBtn}
              aria-label={`Remove photo ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}

        {canAddMore && (
          <label
            htmlFor="photo-input"
            className={
              error && photoPreviews.length === 0
                ? styles.photoAddTileError
                : styles.photoAddTile
            }
          >
            <span className={styles.photoAddIcon} aria-hidden="true">
              📸
            </span>
            <span className={styles.photoAddLabel}>
              {photoPreviews.length === 0 ? "Tap to add photos" : "Add more"}
            </span>
          </label>
        )}
      </div>

      <input
        id="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
        multiple
        onChange={onAddPhotos}
        className={styles.hiddenInput}
      />

      {error && (
        <p className={styles.photoError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
