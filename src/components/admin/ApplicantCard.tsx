import { Trash2, ArchiveRestore, CheckCircle } from "lucide-react";
import { type Application, STATUS_COLORS } from "@/types/application";
import { formatLocation } from "@/utils/locationDisplay";
import { useApplicantPhotos } from "@/components/admin/useApplicantPhotos";
import Spinner from "../ui/Spinner";

interface ApplicantCardProps {
  app: Application;
  onClick: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onParticipated?: () => void;
  dimmed?: boolean;
  /** This card's action in flight: shows a spinner in that button. */
  pendingAction?: "delete" | "restore" | "participated" | null;
  /** Any action in flight anywhere: keeps all action buttons inert. */
  actionsDisabled?: boolean;
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

function AppTypePill({ applicationType }: { applicationType: string }) {
  const isNomination = applicationType === "Nomination";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: isNomination
          ? "rgba(255, 109, 0, 0.12)"
          : "rgba(220, 38, 38, 0.1)",
        color: isNomination ? "var(--spice-orange)" : "var(--brand-red)",
        letterSpacing: "0.02em",
      }}
    >
      {isNomination ? "Nomination" : "Self"}
    </span>
  );
}

export default function ApplicantCard({
  app,
  onClick,
  onDelete,
  onRestore,
  onParticipated,
  dimmed,
  pendingAction,
  actionsDisabled,
}: ApplicantCardProps) {
  const handle = app.instagram.replace(/^@/, "");
  const { photos, count: photoCount } = useApplicantPhotos(app, 1);
  const firstPhoto = photos[0];
  const isNomination = app.applicationType === "Nomination";

  const actionButtons =
    (onDelete ?? onRestore) || onParticipated ? (
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          display: "flex",
          gap: "8px",
          zIndex: 2,
        }}
        className="card-action-buttons"
      >
        {onParticipated && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onParticipated();
            }}
            disabled={actionsDisabled}
            data-pending={pendingAction === "participated" || undefined}
            style={{
              background: "rgba(139, 92, 246, 0.9)",
              border: "none",
              borderRadius: "100px",
              minWidth: "48px",
              minHeight: "48px",
              padding: "10px",
              cursor: actionsDisabled ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              opacity: pendingAction === "participated" ? 1 : 0,
              transition: "opacity 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.background = "rgba(139, 92, 246, 1)";
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(139, 92, 246, 0.9)")
            }
            aria-label={
              pendingAction === "participated"
                ? "Marking as participated"
                : "Mark as participated"
            }
            className="card-action-btn"
          >
            {pendingAction === "participated" ? (
              <Spinner size="sm" label="" />
            ) : (
              <CheckCircle size={18} />
            )}
          </button>
        )}
        {(onDelete || onRestore) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onDelete) onDelete();
              else onRestore?.();
            }}
            disabled={actionsDisabled}
            data-pending={
              pendingAction === "delete" || pendingAction === "restore"
                ? true
                : undefined
            }
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "none",
              borderRadius: "100px",
              minWidth: "48px",
              minHeight: "48px",
              padding: "10px",
              cursor: actionsDisabled ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              opacity:
                pendingAction === "delete" || pendingAction === "restore"
                  ? 1
                  : 0,
              transition: "opacity 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.background = "rgba(0,0,0,0.65)";
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(0,0,0,0.45)")
            }
            aria-label={
              pendingAction === "delete"
                ? "Deleting application"
                : pendingAction === "restore"
                  ? "Restoring application"
                  : onDelete
                    ? "Delete application"
                    : "Restore application"
            }
            className="card-action-btn"
          >
            {pendingAction === "delete" || pendingAction === "restore" ? (
              <Spinner size="sm" label="" />
            ) : onDelete ? (
              <Trash2 size={18} />
            ) : (
              <ArchiveRestore size={18} />
            )}
          </button>
        )}
      </div>
    ) : null;

  return (
    <article
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View application from ${app.name}`}
      style={{
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s, opacity 0.2s",
        opacity: dimmed ? 0.5 : 1,
        filter: dimmed ? "saturate(0.4)" : "none",
        borderLeft: isNomination
          ? "3px solid var(--spice-orange)"
          : "3px solid var(--brand-red)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
        const btns = e.currentTarget.querySelectorAll(
          ".card-action-btn",
        ) as NodeListOf<HTMLElement>;
        btns.forEach((btn) => {
          btn.style.opacity = "1";
        });
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)";
        const btns = e.currentTarget.querySelectorAll(
          ".card-action-btn",
        ) as NodeListOf<HTMLElement>;
        btns.forEach((btn) => {
          // WHY: a delete in flight must stay visible after the pointer leaves,
          // or the loader vanishes and the admin assumes the click never
          // registered (the exact misread that caused a double delete).
          if (btn.dataset.pending !== "true") btn.style.opacity = "0";
        });
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
        {firstPhoto ? (
          <img
            src={firstPhoto}
            alt={app.name}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
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
        {photoCount > 1 && (
          <span
            style={{
              position: "absolute",
              bottom: "8px",
              left: "8px",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "100px",
            }}
          >
            {photoCount} photos
          </span>
        )}
        {actionButtons}
      </div>

      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "4px",
          }}
        >
          <span
            style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)" }}
          >
            {app.name}
          </span>
          <StatusBadge status={app.status} />
        </div>

        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: "6px",
          }}
        >
          {app.age} · {app.gender} · {formatLocation(app)}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "8px",
          }}
        >
          <AppTypePill applicationType={app.applicationType} />
        </div>

        <a
          href={`https://instagram.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: "13px",
            color: "var(--brand-red)",
            textDecoration: "none",
            display: "block",
          }}
        >
          @{handle}
        </a>
      </div>
    </article>
  );
}
