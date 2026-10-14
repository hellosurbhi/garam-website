import type { Templates } from "@/lib/outreach/model";
import type { EmailDashboardData } from "./api";
import AudienceImport from "./AudienceImport";
import styles from "./Email.module.css";
export default function EmailStatus({
  data,
  now,
  busy,
  offline,
  onToggle,
  onImported,
}: {
  data: EmailDashboardData;
  now: number;
  busy: boolean;
  offline: boolean;
  onToggle: (enabled: boolean, templates: Templates) => void;
  onImported: () => void;
}) {
  return (
    <section className={styles.status} aria-label="Sending status">
      <strong>
        {data.settings.value.enabled
          ? "Automatic sending is enabled"
          : "Automatic sending is paused"}
      </strong>
      <p>
        {data.contactCount} contacts ·{" "}
        {data.accounts.length
          ? data.accounts.join(" · ")
          : "Gmail connection needs setup"}
      </p>
      <p>
        Announcement when added. Monday and Friday at 9 AM in the show's
        timezone. Past reminders are skipped. Gmail limits may spread a large
        campaign across more than one day.
      </p>
      {data.sync && (
        <p>
          Contacts refreshed {new Date(data.sync.refreshedAt).toLocaleString()}
        </p>
      )}
      {data.health ? (
        <p>
          Last sender check {new Date(data.health.checkedAt).toLocaleString()}
          {now - data.health.checkedAt > 600000
            ? ". Sender needs attention."
            : ""}
        </p>
      ) : (
        <p>The online sender has not checked in yet.</p>
      )}
      {data.health?.failedAccounts?.length ? (
        <p role="alert">
          Reconnect Gmail: {data.health.failedAccounts.join(", ")}. Other
          connected accounts continue sending.
        </p>
      ) : null}
      <button
        disabled={
          busy ||
          offline ||
          (!data.settings.value.enabled &&
            (!data.accounts.length || !data.settings.value.importedAt))
        }
        onClick={() =>
          onToggle(!data.settings.value.enabled, data.settings.value.templates)
        }
      >
        {data.settings.value.enabled
          ? "Pause automatic emails"
          : "Enable automatic emails"}
      </button>
      {!data.settings.value.importedAt && (
        <AudienceImport onSaved={onImported} />
      )}
    </section>
  );
}
