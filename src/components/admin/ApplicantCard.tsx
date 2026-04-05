import { Trash2, ArchiveRestore } from "lucide-react";
import { type Application, STATUS_COLORS } from "@/types/application";
import { formatLocation } from "@/utils/locationDisplay";

interface ApplicantCardProps {
  app: Application;
  onClick: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  dimmed?: boolean;
}

function StatusBadge({ status }: { status: Application["status"] }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: color + "22",
        color,
        letterSpacing: "0.02em",
      }}
    >
      {status}
    </span>
  );
}

export default function ApplicantCard({ app, onClick, onDelete, onRestore, dimmed }: ApplicantCardProps) {
  const handle = app.instagram.replace(/^@/, "");

  const actionButton = (onDelete ?? onRestore) ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (onDelete) onDelete();
        else onRestore?.();
      }}
      style={{
        position: "absolute",
        top: "8px",
        right: "8px",
        background: "rgba(0,0,0,0.45)",
        border: "none",
        borderRadius: "100px",
        minWidth: "48px",
        minHeight: "48px",
        padding: "10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        opacity: 0,
        transition: "opacity 0.15s, background 0.15s",
        zIndex: 2,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.65)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.45)")}
      aria-label={onDelete ? "Delete application" : "Restore application"}
      className="card-action-btn"
    >
      {onDelete ? <Trash2 size={18} /> : <ArchiveRestore size={18} />}
    </button>
  ) : null;

  return (
    <article
      onClick={onClick}
      style={{
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s, opacity 0.2s",
        opacity: dimmed ? 0.5 : 1,
        filter: dimmed ? "saturate(0.4)" : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
        const btn = e.currentTarget.querySelector(".card-action-btn") as HTMLElement | null;
        if (btn) btn.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)";
        const btn = e.currentTarget.querySelector(".card-action-btn") as HTMLElement | null;
        if (btn) btn.style.opacity = "0";
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3/4",
          maxHeight: "220px",
          overflow: "hidden",
          background: "var(--border)",
        }}
      >
        {app.photoUrl ? (
          <img
            src={app.photoUrl}
            alt={app.name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.5rem",
              color: "var(--text-light)",
            }}
          >
            🌶️
          </div>
        )}
        {actionButton}
      </div>

      <div style={{ padding: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "2px",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)" }}>
            {app.name}
          </span>
          <span style={{ fontSize: "14px", color: "var(--text-light)" }}>{app.age}</span>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-light)", marginBottom: "8px" }}>
          {formatLocation(app)}
        </p>

        <a
          href={`https://instagram.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: "13px",
            color: "var(--hot-pink)",
            textDecoration: "none",
            display: "block",
            marginBottom: "10px",
          }}
        >
          @{handle}
        </a>

        <StatusBadge status={app.status} />
      </div>
    </article>
  );
}
