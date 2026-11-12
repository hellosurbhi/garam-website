/**
 * State and actions for the admin Shows tab (issue 337): load, save the
 * draft, publish, restore, rebuild, and watch the website catch up (R15).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SHOWS_TOAST } from "@/data/adminShows";
import type { EventsSnapshot } from "@/data/eventsSnapshot";
import type { EventsAdminLoad, RebuildStatus } from "@/lib/eventsAdmin.server";
import {
  failureMessage,
  fetchSiteVersion,
  isDenied,
  showsRequest,
  SHOWS_ROUTES,
  type ApiResult,
} from "./showsApi";
import { lockRemainingMs } from "./showsView";

export type ShowsLoad =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: EventsAdminLoad };

export type ShowsAction = "save" | "publish" | "rollback" | "rebuild";

export interface ShowsToast {
  msg: string;
  ok: boolean;
}

interface PublishResult {
  version: number;
  rebuild: RebuildStatus;
}

const VERSION_POLL_MS = 30_000;
const TOAST_MS = 4_000;

async function fetchShows(): Promise<ShowsLoad> {
  const res = await showsRequest<EventsAdminLoad>(SHOWS_ROUTES.load);
  if (res.ok) return { kind: "ready", data: res.data };
  if (isDenied(res)) return { kind: "denied" };
  return { kind: "error", message: res.error };
}

export function useShowsAdmin() {
  const [load, setLoad] = useState<ShowsLoad>({ kind: "loading" });
  // WHY a list, not one pending action: a rebuild and a draft write can be
  // out at once, and whichever finishes first must not clear the other.
  // The editor lock reads draftWriting, so a rebuild settling never unlocks
  // editing while a save is still out (that reopened editor would copy the
  // old draft and undo the save).
  const [inFlight, setInFlight] = useState<readonly ShowsAction[]>([]);
  const [toast, setToast] = useState<ShowsToast | null>(null);
  // undefined: not asked yet; null: /api/version could not say.
  const [siteVersion, setSiteVersion] = useState<number | null>();
  const [now, setNow] = useState(() => Date.now());
  // WHY numbered loads: a rebuild and a save can each reload, and answers
  // come back in any order. A load that started earlier read older data,
  // so applying it after a later one put back a value the admin had just
  // saved (price 25 over 35), and the next save made that loss permanent.
  // Only an answer newer than the one shown is applied.
  const issuedLoads = useRef(0);
  const appliedLoad = useRef(0);
  // WHY counted: the editor stays locked until every reload has answered,
  // so it never opens on a list that one still out is about to replace.
  const [reloading, setReloading] = useState(0);

  const fetchOrdered = useCallback(async (isMounted: () => boolean) => {
    issuedLoads.current += 1;
    const ticket = issuedLoads.current;
    const next = await fetchShows();
    if (!isMounted() || ticket <= appliedLoad.current) return;
    appliedLoad.current = ticket;
    setLoad(next);
    setNow(Date.now());
  }, []);

  const reload = useCallback(async () => {
    setReloading((n) => n + 1);
    await fetchOrdered(() => true);
    setReloading((n) => n - 1);
  }, [fetchOrdered]);

  // WHY not reload(): the first load has to ignore an answer that lands
  // after the tab unmounted, and state is only set in the async callback.
  useEffect(() => {
    let cancelled = false;
    void fetchOrdered(() => !cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchOrdered]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const live = load.kind === "ready" ? load.data.live : null;
  const liveVersion = live?.version;
  const draftUpdateTime =
    load.kind === "ready" ? load.data.draft?.updateTime : undefined;
  const onSite = siteVersion === liveVersion;

  // WHY poll: a publish only asks Vercel to rebuild, and without a Vercel
  // token (R15) the only sign the build finished is /api/version reporting
  // the new number. Stops once the site shows the live version.
  useEffect(() => {
    if (liveVersion === undefined || onSite) return;
    let cancelled = false;
    const check = async () => {
      const version = await fetchSiteVersion();
      if (cancelled) return;
      setSiteVersion(version);
      setNow(Date.now());
    };
    void check();
    const id = setInterval(check, VERSION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [liveVersion, onSite]);

  const lockMs = live ? lockRemainingMs(live, now) : 0;
  const locked = lockMs > 0;
  // Counts the unlock down each second, only while it is locked.
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [locked]);

  const mutate = useCallback(
    async <T>(
      action: ShowsAction,
      path: string,
      body: unknown,
      method: "POST" | "PUT" = "POST",
    ): Promise<ApiResult<T>> => {
      setInFlight((list) => [...list, action]);
      const res = await showsRequest<T>(path, { method, body });
      if (res.ok) {
        await reload();
      } else if (isDenied(res)) {
        setLoad({ kind: "denied" });
      } else if (res.status === 409) {
        // WHY reload: someone published (or saved) first; editing on top of
        // the old version would undo their change.
        await reload();
        setToast({ msg: SHOWS_TOAST.reloaded, ok: false });
      }
      // WHY no toast for other failures: the toast sits outside the open
      // dialog, which makes the rest of the page inert, so the admin would
      // never see it. Each caller shows failureMessage(res) where it acts.
      setInFlight((list) => {
        const at = list.indexOf(action);
        return list.filter((_, i) => i !== at);
      });
      return res;
    },
    [reload],
  );

  const saveDraft = useCallback(
    async (snapshot: EventsSnapshot, doneMsg: string = SHOWS_TOAST.saved) => {
      if (liveVersion === undefined) return null;
      const res = await mutate(
        "save",
        SHOWS_ROUTES.draft,
        { snapshot, basedOnVersion: liveVersion },
        "PUT",
      );
      if (res.ok) setToast({ msg: doneMsg, ok: true });
      return res;
    },
    [liveVersion, mutate],
  );

  const announce = useCallback(
    (res: ApiResult<PublishResult>, done: (v: number) => string) => {
      if (!res.ok) return;
      const { version, rebuild } = res.data;
      setToast(
        rebuild === "requested"
          ? { msg: done(version), ok: true }
          : { msg: SHOWS_TOAST.noRebuild(version), ok: false },
      );
    },
    [],
  );

  const publish = useCallback(
    async (note: string) => {
      if (liveVersion === undefined || !draftUpdateTime) return null;
      // WHY the draft token: the confirmation lists this loaded draft's
      // changes, so the server refuses (409) if a save landed since.
      const res = await mutate<PublishResult>("publish", SHOWS_ROUTES.publish, {
        expectedVersion: liveVersion,
        expectedDraftUpdateTime: draftUpdateTime,
        note,
      });
      announce(res, SHOWS_TOAST.published);
      return res;
    },
    [liveVersion, draftUpdateTime, mutate, announce],
  );

  const rollback = useCallback(
    async (targetVersion: number, note: string) => {
      if (liveVersion === undefined) return null;
      const res = await mutate<PublishResult>(
        "rollback",
        SHOWS_ROUTES.rollback,
        {
          targetVersion,
          expectedVersion: liveVersion,
          note,
        },
      );
      announce(res, SHOWS_TOAST.restored);
      return res;
    },
    [liveVersion, mutate, announce],
  );

  const rebuild = useCallback(async () => {
    const res = await mutate<PublishResult>(
      "rebuild",
      SHOWS_ROUTES.rebuild,
      undefined,
    );
    const failed = failureMessage(res);
    if (res.ok) {
      setToast(
        res.data.rebuild === "requested"
          ? { msg: SHOWS_TOAST.rebuildStarted, ok: true }
          : { msg: SHOWS_TOAST.rebuildFailed, ok: false },
      );
    } else if (failed) {
      // Rebuild opens no dialog, so the toast is where the admin looks.
      setToast({ msg: failed, ok: false });
    }
    return res;
  }, [mutate]);

  return {
    load,
    reload,
    inFlight,
    busy: inFlight.length > 0,
    // A rebuild leaves the draft alone, so editing may start during one,
    // but not while any reload is out (see reloading).
    draftWriting:
      reloading > 0 || inFlight.some((action) => action !== "rebuild"),
    toast,
    siteVersion,
    now,
    lockMs,
    saveDraft,
    publish,
    rollback,
    rebuild,
  };
}

export type ShowsAdmin = ReturnType<typeof useShowsAdmin>;
