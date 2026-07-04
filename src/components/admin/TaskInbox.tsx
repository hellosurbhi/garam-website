import { type ReactNode, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import { type Application } from "@/types/application";
import ContestantInviteModal from "./ContestantInviteModal";
import styles from "./TaskInbox.module.css";

interface TaskInboxProps {
  applications: Application[];
  onOpenApp: (app: Application) => void;
  onRefresh: (id: string, patch: Partial<Application>) => void;
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────
// Fields set via Firestore REST API arrive as ISO strings; fields set via the
// Firebase client SDK arrive as Firestore Timestamps. Handle both.

function toMs(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === "string") {
    const ms = Date.parse(val);
    return isNaN(ms) ? null : ms;
  }
  if (
    typeof val === "object" &&
    val !== null &&
    typeof (val as Record<string, unknown>).toDate === "function"
  ) {
    return (val as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

function hoursAgo(val: unknown): number {
  const ms = toMs(val);
  if (ms === null) return 0;
  return (Date.now() - ms) / (1000 * 60 * 60);
}

function isTodayNYC(val: unknown): boolean {
  const ms = toMs(val);
  if (ms === null) return false;
  const d = new Date(ms);
  const nycDate = d.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const todayNYC = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  return nycDate === todayNYC;
}

function isPastNYCByHours(val: unknown, hours: number): boolean {
  const ms = toMs(val);
  if (ms === null) return false;
  return Date.now() - ms > hours * 60 * 60 * 1000;
}

function relativeTime(val: unknown): string {
  const ms = toMs(val);
  if (ms === null) return "";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function scheduledTimeNYC(val: unknown): string {
  const ms = toMs(val);
  if (ms === null) return "";
  return new Date(ms).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getIdToken(): Promise<string> {
  const auth = await getFirebaseAuth();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function callAction(
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const token = await getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

// ── Bucket computation ────────────────────────────────────────────────────────

type Bucket =
  | "outreach"
  | "scheduling"
  | "todayInterviews"
  | "logOutcome"
  | "needsInvite"
  | "waiverPending";

const DONE_STATUSES = new Set([
  "Rejected",
  "Not Interested",
  "Not Interested Anymore",
  "Said Not Now",
  "Bailed",
  "Cast",
  "Participated",
]);

function getBucket(app: Application): Bucket | null {
  if (app.deletedAt) return null;
  if (DONE_STATUSES.has(app.status) && app.status !== "Cast") return null;

  if (app.decision === "approve" && !app.invitedAt) return "needsInvite";
  if (
    app.invitedAt &&
    !app.waiverSignedAt &&
    hoursAgo(app.waiverNudgeSentAt ?? app.invitedAt) > 48
  )
    return "waiverPending";
  if (
    app.scheduledAt &&
    isPastNYCByHours(app.scheduledAt, 12) &&
    !app.interviewedAt
  )
    return "logOutcome";
  if (app.scheduledAt && isTodayNYC(app.scheduledAt)) return "todayInterviews";
  if (
    app.contactedAt &&
    !app.scheduledAt &&
    hoursAgo(app.followupSentAt ?? app.contactedAt) > 48
  )
    return "scheduling";
  if (app.status === "New" && !app.contactedAt) return "outreach";
  return null;
}

// ── Bucket row ────────────────────────────────────────────────────────────────

interface RowAction {
  label: string;
  loading?: boolean;
  onClick: () => void;
}

function BucketRow({
  app,
  context,
  action,
}: {
  app: Application;
  context: string;
  action: RowAction;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMeta}>
        <span className={styles.rowName}>{app.name}</span>
        <span className={styles.rowCity}>{app.city}</span>
        <span className={styles.rowContext}>{context}</span>
      </div>
      <button
        className={styles.rowAction}
        onClick={action.onClick}
        disabled={action.loading}
      >
        {action.loading ? "Sending..." : action.label}
      </button>
    </div>
  );
}

// ── Decision inline form ───────────────────────────────────────────────────────

function DecisionForm({
  app,
  onDone,
}: {
  app: Application;
  onDone: (patch: Partial<Application>) => void;
}) {
  const [decision, setDecision] = useState<
    "approve" | "reject" | "unsure" | ""
  >("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!decision) return;
    setSaving(true);
    setErr("");
    try {
      await callAction("/api/actions/record-decision", {
        applicationId: app.id,
        decision,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      const now = new Date().toISOString();
      const patch: Partial<Application> = {
        decision: decision as Application["decision"],
        interviewedAt: now as unknown as Application["interviewedAt"],
        decidedAt: now as unknown as Application["decidedAt"],
        ...(decision === "reject"
          ? { status: "Rejected" as Application["status"] }
          : {}),
      };
      onDone(patch);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  }

  return (
    <div className={styles.decisionForm}>
      <div className={styles.decisionRadios}>
        {(["approve", "reject", "unsure"] as const).map((v) => (
          <label key={v} className={styles.decisionRadio}>
            <input
              type="radio"
              name={`decision-${app.id}`}
              value={v}
              checked={decision === v}
              onChange={() => setDecision(v)}
            />
            {v === "approve"
              ? "Approve"
              : v === "reject"
                ? "Reject"
                : "Not sure yet"}
          </label>
        ))}
      </div>
      <textarea
        className={styles.decisionNote}
        aria-label="Decision notes"
        aria-describedby={err ? `decision-error-${app.id}` : undefined}
        placeholder="Notes (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />
      {err && (
        <p
          id={`decision-error-${app.id}`}
          className={styles.decisionErr}
          role="alert"
        >
          {err}
        </p>
      )}
      <button
        className={styles.decisionSave}
        onClick={() => void handleSave()}
        disabled={!decision || saving}
      >
        {saving ? "Saving..." : "Save decision"}
      </button>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  apps,
  renderRow,
}: {
  title: string;
  apps: Application[];
  renderRow: (app: Application) => ReactNode;
}) {
  if (apps.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        <span className={styles.sectionCount}>{apps.length}</span>
      </h2>
      <div className={styles.rows}>{apps.map(renderRow)}</div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskInbox({
  applications,
  onOpenApp,
  onRefresh,
}: TaskInboxProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteApp, setInviteApp] = useState<Application | null>(null);

  async function runAction(
    appId: string,
    fn: () => Promise<void>,
    patch: Partial<Application>,
  ) {
    setLoadingId(appId);
    try {
      await fn();
      onRefresh(appId, patch);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  }

  const buckets: Record<Bucket, Application[]> = {
    outreach: [],
    scheduling: [],
    todayInterviews: [],
    logOutcome: [],
    needsInvite: [],
    waiverPending: [],
  };

  for (const app of applications) {
    const b = getBucket(app);
    if (b) buckets[b].push(app);
  }

  buckets.outreach.sort(
    (a, b) => (toMs(a.submittedAt) ?? 0) - (toMs(b.submittedAt) ?? 0),
  );
  buckets.scheduling.sort(
    (a, b) => (toMs(a.contactedAt) ?? 0) - (toMs(b.contactedAt) ?? 0),
  );
  buckets.todayInterviews.sort(
    (a, b) => (toMs(a.scheduledAt) ?? 0) - (toMs(b.scheduledAt) ?? 0),
  );
  buckets.logOutcome.sort(
    (a, b) => (toMs(a.scheduledAt) ?? 0) - (toMs(b.scheduledAt) ?? 0),
  );
  buckets.needsInvite.sort(
    (a, b) => (toMs(a.decidedAt) ?? 0) - (toMs(b.decidedAt) ?? 0),
  );
  buckets.waiverPending.sort(
    (a, b) => (toMs(a.invitedAt) ?? 0) - (toMs(b.invitedAt) ?? 0),
  );

  const totalItems = Object.values(buckets).reduce(
    (n, arr) => n + arr.length,
    0,
  );

  if (totalItems === 0) {
    return (
      <div className={styles.empty}>
        <p>You're all caught up.</p>
      </div>
    );
  }

  return (
    <div className={styles.inbox}>
      <Section
        title="Needs first outreach"
        apps={buckets.outreach}
        renderRow={(app) => (
          <BucketRow
            key={app.id}
            app={app}
            context={`Applied ${relativeTime(app.submittedAt)}`}
            action={{
              label: "Send scheduling email",
              loading: loadingId === app.id,
              onClick: () =>
                void runAction(
                  app.id,
                  () =>
                    callAction("/api/actions/send-scheduling-email", {
                      applicationId: app.id,
                    }),
                  {
                    contactedAt:
                      new Date().toISOString() as unknown as Application["contactedAt"],
                    status: "Contacted",
                  },
                ),
            }}
          />
        )}
      />

      <Section
        title="Waiting on scheduling"
        apps={buckets.scheduling}
        renderRow={(app) => (
          <BucketRow
            key={app.id}
            app={app}
            context={`Emailed ${relativeTime(app.contactedAt)}`}
            action={{
              label: "Send follow-up",
              loading: loadingId === app.id,
              onClick: () =>
                void runAction(
                  app.id,
                  () =>
                    callAction("/api/actions/send-scheduling-followup", {
                      applicationId: app.id,
                    }),
                  {
                    followupSentAt:
                      new Date().toISOString() as unknown as Application["followupSentAt"],
                  },
                ),
            }}
          />
        )}
      />

      <Section
        title="Today's interviews"
        apps={buckets.todayInterviews}
        renderRow={(app) => (
          <BucketRow
            key={app.id}
            app={app}
            context={`at ${scheduledTimeNYC(app.scheduledAt)}`}
            action={{
              label: "Open",
              onClick: () => onOpenApp(app),
            }}
          />
        )}
      />

      <Section
        title="Log interview outcome"
        apps={buckets.logOutcome}
        renderRow={(app) => (
          <div key={app.id}>
            <BucketRow
              app={app}
              context={`Interviewed ${relativeTime(app.scheduledAt)}`}
              action={{
                label: expandedId === app.id ? "Cancel" : "Record decision",
                onClick: () =>
                  setExpandedId((prev) => (prev === app.id ? null : app.id)),
              }}
            />
            {expandedId === app.id && (
              <DecisionForm
                app={app}
                onDone={(patch) => {
                  onRefresh(app.id, patch);
                  setExpandedId(null);
                }}
              />
            )}
          </div>
        )}
      />

      <Section
        title="Needs show + invite"
        apps={buckets.needsInvite}
        renderRow={(app) => (
          <BucketRow
            key={app.id}
            app={app}
            context={`Approved ${relativeTime(app.decidedAt)}`}
            action={{
              label: "Send invite",
              onClick: () => setInviteApp(app),
            }}
          />
        )}
      />

      <Section
        title="Waiver pending"
        apps={buckets.waiverPending}
        renderRow={(app) => (
          <BucketRow
            key={app.id}
            app={app}
            context={`Invited ${relativeTime(app.invitedAt)}`}
            action={{
              label: "Send waiver nudge",
              loading: loadingId === app.id,
              onClick: () =>
                void runAction(
                  app.id,
                  () =>
                    callAction("/api/actions/send-waiver-nudge", {
                      applicationId: app.id,
                    }),
                  {
                    waiverNudgeSentAt:
                      new Date().toISOString() as unknown as Application["waiverNudgeSentAt"],
                  },
                ),
            }}
          />
        )}
      />

      {inviteApp && (
        <ContestantInviteModal
          app={inviteApp}
          onClose={() => setInviteApp(null)}
          onSuccess={() => {
            onRefresh(inviteApp.id, {
              invitedAt:
                new Date().toISOString() as unknown as Application["invitedAt"],
              status: "Cast",
            });
          }}
        />
      )}
    </div>
  );
}
