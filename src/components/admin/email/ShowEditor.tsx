import { useState } from "react";
import type { ShowInput, Show } from "@/lib/outreach/model";
import { schedule, milestones, render } from "@/lib/outreach/model";
import { emailLabels } from "@/data/outreach";
import { emailApi } from "./api";
import ShowFields from "./ShowFields";
import TemplatesEditor from "./TemplatesEditor";
import styles from "./Email.module.css";
export default function ShowEditor({
  initial,
  version,
  onSaved,
  onCancel,
}: {
  initial: ShowInput;
  version: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [openedAt] = useState(() => Date.now());
  const [show, setShow] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview: Show = { ...show, createdAt: openedAt, updatedAt: openedAt };
  let dates: ReturnType<typeof schedule> | null = null;
  try {
    if (show.date && show.timezone) dates = schedule(preview);
  } catch {
    /* Incomplete form has no schedule yet. */
  }
  return (
    <form
      className={styles.editor}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const id =
            show.id ||
            `${show.city
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")}-${show.date}`;
          await emailApi({ action: "show", show: { ...show, id }, version });
          onSaved();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Show could not be saved",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{version ? "Edit show emails" : "Add a show"}</h2>
      <ShowFields show={show} busy={busy} setShow={setShow} />
      {dates && (
        <p className={styles.schedule}>
          {milestones
            .map(
              (m) =>
                `${emailLabels[m]}: ${dates![m] === null ? "not scheduled" : m === "announcement" ? (version ? "original schedule retained" : "when saved") : new Date(dates![m]!).toLocaleString("en-US", { timeZone: show.timezone })}`,
            )
            .join(" · ")}
        </p>
      )}
      <details>
        <summary>Edit this show's email copy</summary>
        <TemplatesEditor
          value={show.templates}
          disabled={busy}
          onChange={(templates) => setShow({ ...show, templates })}
        />
      </details>
      {show.date && (
        <details>
          <summary>Preview announcement</summary>
          <h3>{render(preview, "announcement").subject}</h3>
          <pre className={styles.preview}>
            {render(preview, "announcement").body}
          </pre>
          <p>An unsubscribe link is added when sent.</p>
        </details>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save show and schedule"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
