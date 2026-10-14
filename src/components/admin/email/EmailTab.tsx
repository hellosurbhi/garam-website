import { useCallback, useEffect, useState } from "react";
import type { ShowInput, Templates } from "@/lib/outreach/model";
import { emailApi, emptyShow, type EmailDashboardData } from "./api";
import ShowEditor from "./ShowEditor";
import DefaultsEditor from "./DefaultsEditor";
import EmailStatus from "./EmailStatus";
import ShowList from "./ShowList";
import styles from "./Email.module.css";
export default function EmailTab() {
  const [now, setNow] = useState(() => Date.now());
  const [data, setData] = useState<EmailDashboardData | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{
    show: ShowInput;
    version: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );
  const load = useCallback(async () => {
    try {
      const next = await emailApi<EmailDashboardData>();
      setData(next);
      setNow(Date.now());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard could not load");
    }
  }, []);
  useEffect(() => {
    let active = true;
    emailApi<EmailDashboardData>()
      .then((next) => {
        if (active) {
          setData(next);
          setNow(Date.now());
        }
      })
      .catch((err: unknown) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Dashboard could not load",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const online = () => setOffline(false),
      offline = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  async function saveSettings(enabled: boolean, copy: Templates) {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await emailApi({
        action: "settings",
        settings: { enabled, templates: copy },
        version: data.settings.version,
      });
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Settings could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h2>Show emails</h2>
          <p>Add the show. The emails take care of themselves.</p>
        </div>
        <button
          disabled={!data || offline}
          onClick={() =>
            data &&
            setEditing({
              show: emptyShow(data.settings.value.templates),
              version: null,
            })
          }
        >
          Add a show
        </button>
      </div>
      {offline && (
        <p role="alert">
          You are offline. Scheduled emails continue online. Reconnect to save
          changes.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error} <button onClick={() => void load()}>Try again</button>
        </p>
      )}
      {!data && !error && (
        <p role="status">Loading shows and email schedules…</p>
      )}
      {data && (
        <>
          <EmailStatus
            data={data}
            now={now}
            busy={busy}
            offline={offline}
            onToggle={(enabled, copy) => void saveSettings(enabled, copy)}
            onImported={() => void load()}
          />
          {editing ? (
            <ShowEditor
              key={editing.show.id || "new"}
              initial={editing.show}
              version={editing.version}
              onSaved={() => {
                setEditing(null);
                void load();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <ShowList data={data} now={now} onEdit={setEditing} />
          )}
          <DefaultsEditor
            key={data.settings.version ?? "new"}
            data={data}
            busy={busy}
            offline={offline}
            onSave={(enabled, copy) => void saveSettings(enabled, copy)}
          />
        </>
      )}
    </main>
  );
}
