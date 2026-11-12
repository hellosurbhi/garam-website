import {
  CHANGE_LABELS,
  DISCARD_DIALOG,
  PUBLISH_DIALOG,
  RESTORE_DIALOG,
} from "@/data/adminShows";
import type { EventsSnapshot, SnapshotDiff } from "@/data/eventsSnapshot";
import ConfirmNoteDialog from "./ConfirmNoteDialog";
import { showName } from "./showsView";
import styles from "./ShowEditorModal.module.css";

export type ShowsDialog =
  | { kind: "editor"; slug?: string; startCanceled?: boolean }
  | { kind: "publish" }
  | { kind: "restore"; version: number }
  | { kind: "discard" };

interface ShowsDialogsProps {
  dialog: ShowsDialog | null;
  draft: EventsSnapshot;
  live: EventsSnapshot;
  changes: SnapshotDiff;
  busy: boolean;
  onPublish: (note: string) => void;
  onRestore: (version: number, note: string) => void;
  onDiscard: () => void;
  onClose: () => void;
}

/** A readable name for a changed slug: "Austin, Jan 9" or the city name. */
function nameFor(slug: string, draft: EventsSnapshot, live: EventsSnapshot) {
  const show = [...draft.events, ...live.events].find((e) => e.slug === slug);
  if (show) return showName(show);
  const city = [...draft.tbaCities, ...live.tbaCities].find(
    (c) => c.citySlug === slug,
  );
  return city?.city ?? slug;
}

/** Publish, restore and discard confirmations. */
export default function ShowsDialogs(props: ShowsDialogsProps) {
  const { dialog, draft, live, changes, busy, onClose } = props;
  if (!dialog || dialog.kind === "editor") return null;

  if (dialog.kind === "publish") {
    const groups = (Object.keys(CHANGE_LABELS) as (keyof SnapshotDiff)[])
      .map((key) => ({ key, slugs: changes[key] }))
      .filter((g) => g.slugs.length > 0);
    return (
      <ConfirmNoteDialog
        title={PUBLISH_DIALOG.title}
        body={PUBLISH_DIALOG.body}
        confirmLabel={PUBLISH_DIALOG.confirm}
        busyLabel={PUBLISH_DIALOG.busy}
        busy={busy}
        askNote
        onConfirm={props.onPublish}
        onClose={onClose}
      >
        {groups.map(({ key, slugs }) => (
          <section key={key} className={styles.changeGroup}>
            <h3 className={styles.changeHeading}>{CHANGE_LABELS[key]}</h3>
            <ul className={styles.changeItems}>
              {slugs.map((slug) => (
                <li key={slug}>{nameFor(slug, draft, live)}</li>
              ))}
            </ul>
          </section>
        ))}
      </ConfirmNoteDialog>
    );
  }

  if (dialog.kind === "restore") {
    const { version } = dialog;
    return (
      <ConfirmNoteDialog
        title={RESTORE_DIALOG.title(version)}
        body={RESTORE_DIALOG.body(version)}
        confirmLabel={RESTORE_DIALOG.confirm(version)}
        busyLabel={RESTORE_DIALOG.busy}
        busy={busy}
        askNote
        onConfirm={(note) => props.onRestore(version, note)}
        onClose={onClose}
      />
    );
  }

  return (
    <ConfirmNoteDialog
      title={DISCARD_DIALOG.title}
      body={DISCARD_DIALOG.body}
      confirmLabel={DISCARD_DIALOG.confirm}
      busyLabel={DISCARD_DIALOG.busy}
      busy={busy}
      askNote={false}
      onConfirm={props.onDiscard}
      onClose={onClose}
    />
  );
}
