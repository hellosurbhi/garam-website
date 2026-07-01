import { useState } from "react";
import { X, Trash2, ArchiveRestore, CheckCircle } from "lucide-react";
import { type Application, STATUS_COLORS } from "@/types/application";
import { formatLocation } from "@/utils/locationDisplay";
import { Modal } from "@/components/ui/Modal";
import styles from "./ApplicantModal.module.css";

interface ApplicantModalProps {
  app: Application;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Omit<Application, "id">>) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onParticipated?: (id: string) => void;
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

function EmailRow({ email }: { email?: string }) {
  if (!email) return null;
  return (
    <div>
      <p className={styles.infoLabel}>Email</p>
      <p className={styles.infoValue}>
        <a href={`mailto:${email}`} className={styles.igLink}>
          {email}
        </a>
      </p>
    </div>
  );
}

export default function ApplicantModal({
  app,
  onClose,
  onUpdate,
  onDelete,
  onRestore,
  onParticipated,
}: ApplicantModalProps) {
  const [status, setStatus] = useState<Application["status"]>(app.status);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [lightbox, setLightbox] = useState(false);
  const handle = app.instagram.replace(/^@/, "");
  const isDeleted = !!app.deletedAt;

  function handleClose() {
    if (notes !== (app.notes ?? "")) {
      onUpdate(app.id, { notes });
    }
    onClose();
  }

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
    : "N/A";

  const statusColor = STATUS_COLORS[status];

  return (
    <Modal
      onClose={handleClose}
      ariaLabelledby="applicant-modal-title"
      className={styles.dialog}
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
          {app.seenShowBefore !== undefined && (
            <InfoRow
              label="Seen Show Before"
              value={app.seenShowBefore ? "Yes" : "No"}
            />
          )}
          {app.type && <InfoRow label="Their Type" value={app.type} />}
          {app.marketingConsent && (
            <InfoRow
              label="Marketing Consent"
              value={app.marketingConsent === "yes" ? "Yes" : "No"}
            />
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
          <EmailRow email={app.email} />
          <InfoRow label="Phone" value={app.phone} />
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
            {(
              ["New", "Contacted", "Cast", "Rejected", "Participated"] as const
            ).map((s) => (
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
          {isDeleted ? (
            onRestore && (
              <button
                onClick={() => onRestore(app.id)}
                className={styles.restoreButton}
              >
                <ArchiveRestore size={16} />
                Restore
              </button>
            )
          ) : (
            <>
              {!isDeleted &&
                onParticipated &&
                app.status !== "Participated" && (
                  <button
                    onClick={() => onParticipated(app.id)}
                    className={styles.participatedButton}
                    style={{
                      background: "#8B5CF6",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "14px",
                      fontWeight: 500,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#7C3AED")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#8B5CF6")
                    }
                  >
                    <CheckCircle size={16} />
                    Mark as Participated
                  </button>
                )}
              {onDelete && (
                <button
                  onClick={() => onDelete(app.id)}
                  className={styles.deleteButton}
                >
                  <Trash2 size={16} />
                  Move to Deleted
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
