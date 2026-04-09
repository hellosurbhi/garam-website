import { useState, useEffect, useRef } from "react";
import { X, Trash2, ArchiveRestore } from "lucide-react";
import { type Application, STATUS_COLORS } from "@/types/application";
import { formatLocation } from "@/utils/locationDisplay";
import styles from "./ApplicantModal.module.css";

interface ApplicantModalProps {
  app: Application;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Omit<Application, "id">>) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
}

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className={styles.infoLabel}>{label}</p>
      <p className={styles.infoValue}>{value}</p>
    </div>
  );
}

export default function ApplicantModal({
  app,
  onClose,
  onUpdate,
  onDelete,
  onRestore,
}: ApplicantModalProps) {
  const [status, setStatus] = useState<Application["status"]>(app.status);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [lightbox, setLightbox] = useState(false);
  const handle = app.instagram.replace(/^@/, "");
  const isDeleted = !!app.deletedAt;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || typeof dialog.showModal !== "function")
      return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function handleClose() {
    if (notes !== (app.notes ?? "")) {
      onUpdate(app.id, { notes });
    }
    onClose();
  }

  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    function onCancel(e: Event) {
      e.preventDefault();
      handleCloseRef.current();
    }
    dialog?.addEventListener("cancel", onCancel);
    return () => dialog?.removeEventListener("cancel", onCancel);
  }, []);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Application["status"];
    setStatus(next);
    onUpdate(app.id, { status: next });
  }

  function handleNotesBlur() {
    onUpdate(app.id, { notes });
  }

  const formattedDate = app.submittedAt
    ? new Date(app.submittedAt.toDate()).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  const statusColor = STATUS_COLORS[status];

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="applicant-modal-title"
      onClick={handleDialogClick}
    >
      <div
        className={styles.imageWrap}
        role="button"
        tabIndex={0}
        aria-label="Open photo preview"
        onClick={() => app.photoUrl && setLightbox(true)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && app.photoUrl) {
            e.preventDefault();
            setLightbox(true);
          }
        }}
      >
        {app.photoUrl ? (
          <img src={app.photoUrl} alt={app.name} className={styles.image} />
        ) : (
          <div className={styles.noPhoto}>🌶️</div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className={styles.closeButton}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {isDeleted && <div className={styles.deletedBanner}>DELETED</div>}
      </div>

      {lightbox && app.photoUrl && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <img
            src={app.photoUrl}
            alt={app.name}
            className={styles.lightboxImage}
          />
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.nameRow}>
          <h2 id="applicant-modal-title" className={styles.name}>
            {app.name}
          </h2>
          <span
            className={styles.statusBadge}
            style={{ "--status-color": statusColor } as React.CSSProperties}
          >
            {status}
          </span>
        </div>

        <div className={styles.infoGrid}>
          <InfoRow label="Age" value={app.age} />
          <InfoRow label="Gender" value={app.gender} />
          <InfoRow label="Orientation" value={app.orientation} />
          <InfoRow label="Location" value={formatLocation(app)} />
          <InfoRow label="Height" value={app.height} />
          <InfoRow label="Community" value={app.community} />
          <InfoRow label="Income" value={app.income} />
          <InfoRow label="Application Type" value={app.applicationType} />
          {app.applicationType === "Nomination" && (
            <InfoRow label="Referred by" value={app.referrerName} />
          )}
          <div>
            <p className={styles.infoLabel}>Instagram</p>
            <a
              href={`https://instagram.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.igLink}
            >
              @{handle}
            </a>
          </div>
        </div>

        {app.pitch && (
          <blockquote className={styles.pitch}>
            <p className={styles.pitchText}>{app.pitch}</p>
          </blockquote>
        )}

        <p className={styles.submittedDate}>Submitted {formattedDate}</p>

        <hr className={styles.divider} />

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Status</label>
          <select
            value={status}
            onChange={handleStatusChange}
            className={styles.statusSelect}
          >
            {(["New", "Contacted", "Cast", "Rejected"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={styles.formLabel}>Internal Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={4}
            placeholder="Add internal notes..."
            className={styles.notesTextarea}
          />
        </div>

        <hr className={styles.dividerSpaced} />

        <div className={styles.actionRow}>
          {isDeleted
            ? onRestore && (
                <button
                  onClick={() => onRestore(app.id)}
                  className={styles.restoreButton}
                >
                  <ArchiveRestore size={16} />
                  Restore
                </button>
              )
            : onDelete && (
                <button
                  onClick={() => onDelete(app.id)}
                  className={styles.deleteButton}
                >
                  <Trash2 size={16} />
                  Move to Deleted
                </button>
              )}
        </div>
      </div>
    </dialog>
  );
}
