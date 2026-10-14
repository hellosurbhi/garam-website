import { useState } from "react";
import type { Delivery, Milestone } from "@/lib/outreach/model";
import { emailApi } from "./api";
import styles from "./Email.module.css";
type Row = { id: string; version: string; value: Delivery };
export default function DeliveryIssues({
  showId,
  milestone,
}: {
  showId: string;
  milestone: Milestone;
}) {
  const [rows, setRows] = useState<Row[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setRows(
        await emailApi<Row[]>(
          undefined,
          `/delivery?${new URLSearchParams({ showId, milestone })}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Details could not load");
    }
  }
  async function resolve(row: Row, outcome: "sent" | "not_sent") {
    setBusy(true);
    setError("");
    try {
      await emailApi(
        { showId, milestone, id: row.id, version: row.version, outcome },
        "/delivery",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open && !rows) void load();
      }}
    >
      <summary>Review deliveries that need attention</summary>
      <p>
        Check the sending account's Sent folder for this recipient and subject
        before choosing either action. A lost response can mean the email
        already went out.
      </p>
      {error && <p role="alert">{error}</p>}
      {!rows ? (
        <p role="status">Loading delivery details…</p>
      ) : rows.length === 0 ? (
        <p>No unresolved deliveries.</p>
      ) : (
        rows.map((row) => (
          <div key={row.id} className={styles.show}>
            <p>
              {row.value.email}
              <br />
              From {row.value.account}
              <br />
              {row.value.subject}
              <br />
              Attempted {new Date(row.value.attemptedAt).toLocaleString()}
            </p>
            <div className={styles.actions}>
              <button disabled={busy} onClick={() => void resolve(row, "sent")}>
                I checked Gmail: it was sent
              </button>
              <button
                disabled={busy}
                onClick={() => void resolve(row, "not_sent")}
              >
                I checked Gmail: retry this email
              </button>
            </div>
          </div>
        ))
      )}
    </details>
  );
}
