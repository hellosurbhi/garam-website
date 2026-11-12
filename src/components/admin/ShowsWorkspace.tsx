import { useMemo, useState } from "react";
import { SHOWS_TOAST } from "@/data/adminShows";
import type { SnapshotDiff } from "@/data/eventsSnapshot";
import type { EventsAdminLoad } from "@/lib/eventsAdmin.server";
import { utcTodayIso } from "@/utils/date";
import ComingSoonCities from "./ComingSoonCities";
import ShowEditorModal from "./ShowEditorModal";
import ShowsDialogs from "./ShowsDialogs";
import ShowsHistory from "./ShowsHistory";
import ShowsList from "./ShowsList";
import ShowsStatus from "./ShowsStatus";
import ShowsToolbar from "./ShowsToolbar";
import StaleEditorNotice from "./StaleEditorNotice";
import type { ShowsAdmin } from "./useShowsAdmin";
import { useShowsDialog } from "./useShowsDialog";
import { countChanges, previewShows, sitePhase, sortShows } from "./showsView";
import styles from "./ShowsTab.module.css";

const NO_CHANGES: SnapshotDiff = {
  added: [],
  changed: [],
  canceled: [],
  tbaCitiesAdded: [],
  tbaCitiesChanged: [],
  tbaCitiesRemoved: [],
};

interface ShowsWorkspaceProps {
  admin: ShowsAdmin;
  data: EventsAdminLoad;
}

/** Everything on the Shows tab once the shows have loaded. */
export default function ShowsWorkspace({ admin, data }: ShowsWorkspaceProps) {
  const [showHistory, setShowHistory] = useState(false);
  const { live, cities } = data;
  const { busy, draftWriting } = admin;
  const { dialog, session, stale, error, show, close, settle } = useShowsDialog(
    live.version,
    draftWriting,
  );
  // WHY: a draft saved on top of an older live version would undo whatever
  // was published since, so it is set aside and editing starts from live.
  const fresh = data.draft?.basedOnVersion === live.version ? data.draft : null;
  const draft = fresh?.snapshot ?? live.snapshot;
  const changes = fresh?.changes ?? NO_CHANGES;
  const waitlist = (fresh && data.waitlist.draft) || data.waitlist.live;
  const changeCount = countChanges(changes);
  // The hook's clock, and the UTC day the public pages use (utcTodayIso).
  const todayIso = utcTodayIso(new Date(admin.now));
  const previews = useMemo(
    () => previewShows(draft, todayIso, waitlist),
    [draft, todayIso, waitlist],
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
  const locked = admin.lockMs > 0;

  return (
    <div className={styles.dashboard}>
      <ShowsStatus
        data={data}
        phase={sitePhase(live, admin.siteVersion, admin.now)}
        lockMs={admin.lockMs}
        changeCount={changeCount}
        rebuilding={admin.inFlight.includes("rebuild")}
        busy={busy}
        onRebuild={() => void admin.rebuild()}
      />
      <ShowsToolbar
        busy={busy}
        locked={locked}
        changeCount={changeCount}
        historyOpen={showHistory}
        onAdd={() => show({ kind: "editor" })}
        onPublish={() => show({ kind: "publish" })}
        onDiscard={() => show({ kind: "discard" })}
        onToggleHistory={() => setShowHistory((v) => !v)}
      />
      {showHistory && (
        <ShowsHistory
          history={data.history}
          liveVersion={live.version}
          disabled={busy || locked}
          onRestore={(version) => show({ kind: "restore", version })}
        />
      )}
      <ShowsList
        shows={shows}
        previews={previews}
        pendingSlugs={pendingSlugs}
        todayIso={todayIso}
        disabled={draftWriting}
        onEdit={(slug) => show({ kind: "editor", slug })}
        onCancel={(slug) => show({ kind: "editor", slug, startCanceled: true })}
      />
      <ComingSoonCities
        snapshot={draft}
        live={live.snapshot}
        cities={cities}
        notifyCities={waitlist.cities}
        busy={busy}
        onSave={(snapshot) => admin.saveDraft(snapshot)}
      />
      {stale && <StaleEditorNotice onDismiss={close} />}
      {dialog?.kind === "editor" && !stale && (
        <ShowEditorModal
          key={session}
          snapshot={draft}
          live={live.snapshot}
          cities={cities}
          slug={dialog.slug}
          startCanceled={dialog.startCanceled}
          saving={admin.inFlight.includes("save")}
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
        error={error}
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
