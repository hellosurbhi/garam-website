import { useState, useMemo } from "react";
import { X, Trash2, ArchiveRestore, Send } from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import {
  type Application,
  type ApplicantStatus,
  STATUS_COLORS,
  STATUS_ORDER,
} from "@/types/application";
import { formatLocation } from "@/utils/locationDisplay";
import { getApplicantPhotos } from "@/utils/applicantPhotos";
import { Modal } from "@/components/ui/Modal";
import { events } from "@/data/events";
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

const TODAY_ISO = new Date().toISOString().slice(0, 10);

function castEventKey(e: (typeof events)[number]): string {
  return `${e.isoDate ?? ""}__${e.citySlug ?? e.city}`;
}

export default function ApplicantModal({
  app,
  onClose,
  onUpdate,
  onDelete,
  onRestore,
}: ApplicantModalProps) {
  const [status, setStatus] = useState<ApplicantStatus>(
    app.status as ApplicantStatus,
  );
  const [castEventId, setCastEventId] = useState(app.castEventId ?? "");
  const [notes, setNotes] = useState(app.notes ?? "");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [schedulingEmailState, setSchedulingEmailState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const handle = app.instagram.replace(/^@/, "");
  const isDeleted = !!app.deletedAt;
  const isNomination = app.applicationType === "Nomination";

  const photos = useMemo(() => getApplicantPhotos(app), [app]);
  const currentPhoto = photos[selectedPhotoIndex] ?? photos[0];

  const upcomingEvents = useMemo(
    () => events.filter((e) => e.isoDate && e.isoDate >= TODAY_ISO),
    [],
  );

  function handleClose() {
    if (notes !== (app.notes ?? "")) {
      onUpdate(app.id, { notes });
    }
    onClose();
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ApplicantStatus;
    setStatus(next);
    onUpdate(app.id, { status: next });
    if (next !== "Cast") {
      setCastEventId("");
      onUpdate(app.id, { status: next, castEventId: "" });
    }
  }

  function handleCastEventChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setCastEventId(val);
    onUpdate(app.id, { castEventId: val });
  }

  function handleNotesBlur() {
    onUpdate(app.id, { notes });
  }

  async function handleSendSchedulingEmail() {
    if (!app.email) return;
    setSchedulingEmailState("sending");
    try {
      const auth = await getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/actions/send-scheduling-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ applicationId: app.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const db = getFirebaseDb();
      const appRef = doc(db, "applications", app.id);
      await updateDoc(appRef, {
        contactedAt: serverTimestamp(),
        ...(status === "New" ? { status: "Contacted" } : {}),
      });
      await addDoc(collection(db, "applications", app.id, "events"), {
        type: "outreach_sent",
        timestamp: serverTimestamp(),
        actor: auth.currentUser?.email ?? "admin",
        payload: {},
      });

      if (status === "New") {
        setStatus("Contacted");
        onUpdate(app.id, { status: "Contacted" });
      }
      setSchedulingEmailState("sent");
    } catch {
      setSchedulingEmailState("error");
    }
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
  const allStatuses: readonly ApplicantStatus[] = [
    ...STATUS_ORDER,
    "Participated",
  ];

  return (
    <Modal
      onClose={handleClose}
      ariaLabelledby="applicant-modal-title"
      className={styles.dialog}
    >
      {/* ── Photo area ─────────────────────────────────── */}
      <div
        className={styles.imageWrap}
        role="button"
        tabIndex={0}
        aria-label="Open photo preview"
        onClick={() => currentPhoto && setLightbox(true)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && currentPhoto) {
            e.preventDefault();
            setLightbox(true);
          }
        }}
      >
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt={`${app.name} photo ${selectedPhotoIndex + 1}`}
            className={styles.image}
          />
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

      {/* ── Thumbnail strip (only when multiple photos) ── */}
      {photos.length > 1 && (
        <div className={styles.photoStrip} role="list" aria-label="All photos">
          {photos.map((url: string, i: number) => (
            <button
              key={url}
              role="listitem"
              onClick={() => setSelectedPhotoIndex(i)}
              className={
                i === selectedPhotoIndex
                  ? styles.photoThumbActive
                  : styles.photoThumb
              }
              aria-label={`Photo ${i + 1}`}
              aria-pressed={i === selectedPhotoIndex}
            >
              <img
                src={url}
                alt={`${app.name} photo ${i + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {lightbox && currentPhoto && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <img
            src={currentPhoto}
            alt={app.name}
            className={styles.lightboxImage}
          />
        </div>
      )}

      <div className={styles.body}>
        {/* ── Name + status ──────────────────────────────── */}
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

        {/* ── Identity summary ────────────────────────────── */}
        <p className={styles.identitySummary}>
          {app.age} · {app.gender} · {formatLocation(app)}
        </p>

        <div className={styles.appTypePill} data-nomination={isNomination}>
          {isNomination ? "Nomination" : "Self"}
        </div>

        {/* ── Info grid ────────────────────────────────────── */}
        <div className={styles.infoGrid}>
          <InfoRow label="Height" value={app.height} />
          <InfoRow label="Orientation" value={app.orientation} />
          <InfoRow label="Community" value={app.community} />
          <InfoRow label="Income" value={app.income} />
          {isNomination && (
            <InfoRow label="Referred by" value={app.referrerName} />
          )}
          {isNomination && (
            <div>
              <p className={styles.infoLabel}>Nominator consent</p>
              <p
                className={styles.infoValue}
                style={{
                  color: app.nominationConsent ? "#10B981" : "#EF4444",
                }}
              >
                {app.nominationConsent
                  ? "Confirmed permission"
                  : "Not confirmed"}
              </p>
            </div>
          )}
          {app.seenShowBefore !== undefined && (
            <InfoRow
              label="Seen Show Before"
              value={app.seenShowBefore ? "Yes" : "No"}
            />
          )}
          {app.type && <InfoRow label="Their Type" value={app.type} />}
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

        {/* ── Status select ──────────────────────────────── */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="applicant-status">
            Status
          </label>
          <select
            id="applicant-status"
            value={status}
            onChange={handleStatusChange}
            className={styles.statusSelect}
          >
            {allStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* ── Cast event select (only when Cast) ─────────── */}
        {status === "Cast" && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="cast-event">
              Cast for which event?
            </label>
            <select
              id="cast-event"
              value={castEventId}
              onChange={handleCastEventChange}
              className={styles.statusSelect}
            >
              <option value="">— pick event —</option>
              {upcomingEvents.map((e) => (
                <option key={castEventKey(e)} value={castEventKey(e)}>
                  {e.city}, {e.stateAbbr} — {e.date}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Notes ─────────────────────────────────────── */}
        <div>
          <label className={styles.formLabel} htmlFor="applicant-notes">
            Internal Notes
          </label>
          <textarea
            id="applicant-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={4}
            placeholder="Add internal notes..."
            className={styles.notesTextarea}
          />
        </div>

        <hr className={styles.dividerSpaced} />

        {/* ── Send scheduling email ─────────────────────── */}
        {app.email && (
          <div className={styles.formGroup}>
            <button
              onClick={() => void handleSendSchedulingEmail()}
              disabled={
                schedulingEmailState === "sending" ||
                schedulingEmailState === "sent"
              }
              className={styles.sendEmailButton}
              aria-label="Send scheduling email to applicant"
            >
              <Send size={15} />
              {schedulingEmailState === "idle" && "Send scheduling email"}
              {schedulingEmailState === "sending" && "Sending..."}
              {schedulingEmailState === "sent" && "Email sent"}
              {schedulingEmailState === "error" && "Failed — try again"}
            </button>
            {schedulingEmailState === "error" && (
              <p className={styles.sendEmailError} role="alert">
                Could not send email. Check your Zoho SMTP config or try again.
              </p>
            )}
          </div>
        )}

        {/* ── Action buttons ────────────────────────────── */}
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
    </Modal>
  );
}
