import { useMemo, useState } from "react";
import { SHOWS_TOAST } from "@/data/adminShows";
import type { SnapshotDiff } from "@/data/eventsSnapshot";
import type { EventsAdminLoad } from "@/lib/eventsAdmin.server";
import ComingSoonCities from "./ComingSoonCities";
import ShowEditorModal from "./ShowEditorModal";
import ShowsDialogs, { type ShowsDialog } from "./ShowsDialogs";
import ShowsHistory from "./ShowsHistory";
import ShowsList from "./ShowsList";
import ShowsStatus from "./ShowsStatus";
import ShowsToolbar from "./ShowsToolbar";
import type { ShowsAdmin } from "./useShowsAdmin";
import {
  countChanges,
  localTodayIso,
  previewShows,
  sitePhase,
  sortShows,
} from "./showsView";
import styles from "./ShowsTab.module.css";

const NO_CHANGES: SnapshotDiff = {
  added: [],
  changed: [],
  canceled: [],
  tbaCitiesAdded: [],
  tbaCitiesRemoved: [],
};

interface ShowsWorkspaceProps {
  admin: ShowsAdmin;
  data: EventsAdminLoad;
}

/** Everything on the Shows tab once the shows have loaded. */
export default function ShowsWorkspace({ admin, data }: ShowsWorkspaceProps) {
  const [dialog, setDialog] = useState<ShowsDialog | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { live, cities } = data;
  // WHY: a draft saved on top of an older live version would undo whatever
  // was published since, so it is set aside and editing starts from live.
  const fresh = data.draft?.basedOnVersion === live.version ? data.draft : null;
  const draft = fresh?.snapshot ?? live.snapshot;
  const changes = fresh?.changes ?? NO_CHANGES;
  const changeCount = countChanges(changes);
  const todayIso = localTodayIso();
  const previews = useMemo(
    () => previewShows(draft, todayIso),
    [draft, todayIso],
  );
  const shows = useMemo(
    () => sortShows(draft.events, todayIso),
    [draft, todayIso],
  );
  const pendingSlugs = new Set([
    ...changes.added,
    ...changes.changed,
    ...changes.canceled,
  ]);
  const busy = admin.pending !== null;
  const locked = admin.lockMs > 0;
  const close = () => setDialog(null);
  const settle = (res: { ok: boolean; status?: number } | null) => {
    if (res && (res.ok || res.status === 409)) close();
  };

  return (
    <div className={styles.dashboard}>
      <ShowsStatus
        data={data}
        phase={sitePhase(live, admin.siteVersion, admin.now)}
        lockMs={admin.lockMs}
        changeCount={changeCount}
        rebuilding={admin.pending === "rebuild"}
        busy={busy}
        onRebuild={() => void admin.rebuild()}
      />
      <ShowsToolbar
        busy={busy}
        locked={locked}
        changeCount={changeCount}
        historyOpen={showHistory}
        onAdd={() => setDialog({ kind: "editor" })}
        onPublish={() => setDialog({ kind: "publish" })}
        onDiscard={() => setDialog({ kind: "discard" })}
        onToggleHistory={() => setShowHistory((v) => !v)}
      />
      {showHistory && (
        <ShowsHistory
          history={data.history}
          liveVersion={live.version}
          disabled={busy || locked}
          onRestore={(version) => setDialog({ kind: "restore", version })}
        />
      )}
      <ShowsList
        shows={shows}
        previews={previews}
        pendingSlugs={pendingSlugs}
        todayIso={todayIso}
        onEdit={(slug) => setDialog({ kind: "editor", slug })}
        onCancel={(slug) =>
          setDialog({ kind: "editor", slug, startCanceled: true })
        }
      />
      <ComingSoonCities
        snapshot={draft}
        live={live.snapshot}
        cities={cities}
        busy={busy}
        onSave={(snapshot) => admin.saveDraft(snapshot)}
      />
      {dialog?.kind === "editor" && (
        <ShowEditorModal
          snapshot={draft}
          live={live.snapshot}
          cities={cities}
          slug={dialog.slug}
          startCanceled={dialog.startCanceled}
          saving={admin.pending === "save"}
          onSave={(snapshot) => admin.saveDraft(snapshot)}
          onClose={close}
        />
      )}
      <ShowsDialogs
        dialog={dialog}
        draft={draft}
        live={live.snapshot}
        changes={changes}
        busy={busy}
        onPublish={async (note) => settle(await admin.publish(note))}
        onRestore={async (version, note) =>
          settle(await admin.rollback(version, note))
        }
        onDiscard={async () =>
          settle(await admin.saveDraft(live.snapshot, SHOWS_TOAST.discarded))
        }
        onClose={close}
      />
    </div>
  );
}
