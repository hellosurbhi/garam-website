import { useCallback, useMemo, useState, type FormEvent } from "react";
import { EDITOR } from "@/data/adminShows";
import type { EventsSnapshot } from "@/data/eventsSnapshot";
import type { AdminCityOption } from "@/lib/eventsAdmin.server";
import { Modal } from "../ui/Modal";
import ShowCardFields from "./ShowCardFields";
import {
  ShowEditorActions,
  ShowEditorHeader,
  ShowIssueSummary,
} from "./ShowEditorChrome";
import ShowTicketFields from "./ShowTicketFields";
import ShowWhereFields from "./ShowWhereFields";
import {
  emptyForm,
  formFromEntry,
  isPublished,
  noteRequired,
  savedVenues,
  withCity,
  withTimezone,
  type SetField,
  type ShowForm,
} from "./showForm";
import { checkShowForm, splitIssues } from "./showIssues";
import {
  attemptSettled,
  failureMessage,
  type ApiResult,
  type FieldIssue,
} from "./showsApi";
import styles from "./ShowEditorModal.module.css";

interface ShowEditorModalProps {
  /** The draft being edited. */
  snapshot: EventsSnapshot;
  /** The live version, which the draft is validated against. */
  live: EventsSnapshot;
  cities: AdminCityOption[];
  /** The show to edit; omitted to add a new one. */
  slug?: string;
  /** Opened from "Cancel show": starts with Canceled ticked. */
  startCanceled?: boolean;
  saving: boolean;
  onSave: (snapshot: EventsSnapshot) => Promise<ApiResult<unknown> | null>;
  onClose: () => void;
}

/** Add or edit one show, checked with the same rules the server applies. */
export default function ShowEditorModal({
  snapshot,
  live,
  cities,
  slug,
  startCanceled,
  saving,
  onSave,
  onClose,
}: ShowEditorModalProps) {
  const found = slug ? snapshot.events.findIndex((e) => e.slug === slug) : -1;
  const index = found === -1 ? snapshot.events.length : found;
  const base = found === -1 ? undefined : snapshot.events[found];
  const [initial] = useState<ShowForm>(() =>
    base ? formFromEntry(base, snapshot.events) : emptyForm(),
  );
  const [form, setForm] = useState<ShowForm>(() => ({
    ...initial,
    canceled: initial.canceled || Boolean(startCanceled),
  }));
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const set: SetField = useCallback(
    (key, value) => setForm((f) => ({ ...f, [key]: value })),
    [],
  );
  const venues = useMemo(() => savedVenues(snapshot.events), [snapshot]);
  const noteNeeded = noteRequired(form, base, isPublished(base, live));
  const { fields, other } = splitIssues(issues, snapshot, index);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    // WHY: saving an untouched form would still stamp a new updatedAt and
    // mark the show as changed in the publish summary.
    if (JSON.stringify(form) === JSON.stringify(initial)) return onClose();
    const { candidate, problems } = checkShowForm({
      form,
      initial,
      base,
      index,
      snapshot,
      live,
      cities,
      nowIso: new Date().toISOString(),
    });
    setIssues(problems);
    if (problems.length > 0) return;
    const res = await onSave(candidate);
    if (attemptSettled(res)) return onClose();
    if (res && !res.ok) setIssues(res.issues);
    // Field problems show inline; only a failure without them needs words.
    setFailure(
      res && !res.ok && res.issues.length > 0 ? null : failureMessage(res),
    );
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabelledby="show-editor-title"
      className={styles.dialog}
    >
      <ShowEditorHeader
        title={base ? EDITOR.titleEdit(base.city, base.date) : EDITOR.titleNew}
        onClose={onClose}
      />
      <form
        className={`${styles.body} ${styles.form}`}
        onSubmit={submit}
        noValidate
      >
        <ShowWhereFields
          form={form}
          set={set}
          errors={fields}
          cityEditable={!base}
          cities={cities}
          onPickCity={(city) => setForm((f) => withCity(f, city, snapshot))}
          onPickZone={(zone) => setForm((f) => withTimezone(f, zone, base))}
          venues={venues}
        />
        <ShowTicketFields form={form} set={set} errors={fields} />
        <ShowCardFields
          form={form}
          set={set}
          errors={fields}
          noteNeeded={noteNeeded}
        />
        {(issues.length > 0 || failure) && (
          <ShowIssueSummary other={other} failure={failure} />
        )}
        <ShowEditorActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}
