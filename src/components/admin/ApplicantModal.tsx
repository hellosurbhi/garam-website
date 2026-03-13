import { useState, useEffect } from "react";
import { X, Trash2, ArchiveRestore } from "lucide-react";
import { type Application, STATUS_COLORS } from "@/types/application";
import { formatLocation } from "@/utils/locationDisplay";

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
      <p
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-light)",
          marginBottom: "3px",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)" }}>{value}</p>
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    : "—";

  const statusColor = STATUS_COLORS[status];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          maxWidth: "640px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxHeight: "400px",
            overflow: "hidden",
            borderRadius: "16px 16px 0 0",
            background: "var(--border)",
          }}
        >
          {app.photoUrl ? (
            <img
              src={app.photoUrl}
              alt={app.name}
              style={{ width: "100%", height: "400px", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "4rem",
              }}
            >
              🌶️
            </div>
          )}

          <button
            onClick={handleClose}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "rgba(0,0,0,0.45)",
              border: "none",
              borderRadius: "100px",
              padding: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.65)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.45)")}
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {isDeleted && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "rgba(220,38,38,0.85)",
                color: "#fff",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                padding: "6px 0",
              }}
            >
              DELETED
            </div>
          )}
        </div>

        <div style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {app.name}
            </h2>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 600,
                background: statusColor + "22",
                color: statusColor,
              }}
            >
              {status}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 24px",
              marginBottom: "24px",
            }}
          >
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
              <p
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-light)",
                  marginBottom: "3px",
                }}
              >
                Instagram
              </p>
              <a
                href={`https://instagram.com/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "14px", fontWeight: 500, color: "var(--crimson)" }}
              >
                @{handle}
              </a>
            </div>
          </div>

          {app.pitch && (
            <blockquote
              style={{
                borderLeft: "3px solid var(--crimson)",
                paddingLeft: "16px",
                margin: "0 0 24px",
              }}
            >
              <p
                style={{
                  fontStyle: "italic",
                  fontSize: "14px",
                  color: "var(--text)",
                  lineHeight: 1.6,
                }}
              >
                {app.pitch}
              </p>
            </blockquote>
          )}

          <p style={{ fontSize: "12px", color: "var(--text-light)", marginBottom: "24px" }}>
            Submitted {formattedDate}
          </p>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: "24px" }} />

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-light)",
                marginBottom: "8px",
              }}
            >
              Status
            </label>
            <select
              value={status}
              onChange={handleStatusChange}
              style={{
                padding: "10px 14px",
                borderRadius: "100px",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                color: "var(--text)",
                background: "#fff",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {(["New", "Contacted", "Cast", "Rejected"] as const).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-light)",
                marginBottom: "8px",
              }}
            >
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={4}
              placeholder="Add internal notes..."
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                color: "var(--text)",
                background: "#fff",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                lineHeight: 1.5,
              }}
            />
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "24px 0" }} />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {isDeleted ? (
              onRestore && (
                <button
                  onClick={() => onRestore(app.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 18px",
                    borderRadius: "100px",
                    border: "1px solid var(--success)",
                    background: "transparent",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--success)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#22C55E11")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <ArchiveRestore size={16} />
                  Restore
                </button>
              )
            ) : (
              onDelete && (
                <button
                  onClick={() => onDelete(app.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 18px",
                    borderRadius: "100px",
                    border: "1px solid var(--crimson)",
                    background: "transparent",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--crimson)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
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
