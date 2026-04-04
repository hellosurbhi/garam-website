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

export default function ApplicantModal({ app, onClose, onUpdate, onDelete, onRestore }: ApplicantModalProps) {
  const [status, setStatus] = useState<Application["status"]>(app.status);
  const [notes, setNotes] = useState(app.notes ?? "");
  const handle = app.instagram.replace(/^@/, "");
  const isDeleted = !!app.deletedAt;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handleClose() {
    if (notes !== (app.notes ?? "")) {
      onUpdate(app.id, { notes });
    }
    onClose();
  }

  const handleCloseRef = useRef(handleClose);
  useEffect(() => { handleCloseRef.current = handleClose; });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.imageWrap}>
          {app.photoUrl ? (
            <img src={app.photoUrl} alt={app.name} className={styles.image} />
          ) : (
            <div className={styles.noPhoto}>🌶️</div>
          )}

          <button onClick={handleClose} className={styles.closeButton} aria-label="Close">
            <X size={18} />
          </button>

          {isDeleted && <div className={styles.deletedBanner}>DELETED</div>}
        </div>

        <div className={styles.body}>
          <div className={styles.nameRow}>
            <h2 className={styles.name}>{app.name}</h2>
            <span
              className={styles.statusBadge}
              style={{ background: statusColor + "22", color: statusColor }}
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
            <select value={status} onChange={handleStatusChange} className={styles.statusSelect}>
              {(["New", "Contacted", "Cast", "Rejected"] as const).map((s) => (
                <option key={s} value={s}>{s}</option>
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
            {isDeleted ? (
              onRestore && (
                <button onClick={() => onRestore(app.id)} className={styles.restoreButton}>
                  <ArchiveRestore size={16} />
                  Restore
                </button>
              )
            ) : (
              onDelete && (
                <button onClick={() => onDelete(app.id)} className={styles.deleteButton}>
                  <Trash2 size={16} />
                  Move to Deleted
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
