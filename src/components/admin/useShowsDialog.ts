/**
 * Which Shows dialog is open, and what went wrong in it (issue 337).
 */
import { useCallback, useRef, useState } from "react";
import type { ShowsDialog } from "./ShowsDialogs";
import { attemptSettled, failureMessage, type ApiResult } from "./showsApi";

interface OpenDialog {
  dialog: ShowsDialog;
  /** The live version when it opened. */
  openedOn: number;
  /** The draft's updateTime when it opened (null: no draft). */
  openedDraft: string | null;
  /** True while this dialog's own draft save is out. */
  saving: boolean;
  /** Counts every opening, so a late answer can tell it is not its own. */
  session: number;
  error: string | null;
}

export function useShowsDialog(
  liveVersion: number,
  draftToken: string | null,
  draftWriting: boolean,
) {
  const [open, setOpen] = useState<OpenDialog | null>(null);
  const opened = useRef(0);
  const session = open?.session ?? 0;

  // WHY nothing opens while a draft write (save, publish, restore) is in
  // flight: a dialog copies the draft
  // when it opens, and the write still out is about to replace it, so
  // saving the copy afterwards would undo it. Refusing to open (the buttons
  // are disabled too) is simpler than marking the copy stale on arrival and
  // never throws away anything the admin typed.
  const show = useCallback(
    (dialog: ShowsDialog) => {
      if (draftWriting) return;
      opened.current += 1;
      setOpen({
        dialog,
        openedOn: liveVersion,
        openedDraft: draftToken,
        saving: false,
        session: opened.current,
        error: null,
      });
    },
    [liveVersion, draftToken, draftWriting],
  );
  // WHY scoped to the session that rendered it: a save or publish answer can
  // land after the admin closed that dialog and opened another one. Closing
  // or erroring "whatever is open" then would shut the new dialog and throw
  // away what was typed in it, so each callback only touches its own session.
  const close = useCallback(
    () => setOpen((o) => (o?.session === session ? null : o)),
    [session],
  );
  /** After a publish, restore or discard: close, or say why it failed. */
  const settle = useCallback(
    (res: ApiResult<unknown> | null) => {
      if (attemptSettled(res)) return close();
      const error = failureMessage(res);
      setOpen((o) => (o?.session === session ? { ...o, error } : o));
    },
    [close, session],
  );

  /**
   * Save the editor's copy against the draft it was opened from. WHY the
   * token captured at open, not the latest one: a reload can bring another
   * admin's save while the editor still shows the older values, and
   * re-basing onto that token let a save of the old values overwrite theirs.
   * On success the dialog closes in the same update that ends the save, so
   * its own new draft never reads as someone else's change.
   */
  const saveFrom = useCallback(
    async (
      save: (
        expectedDraft: string | null,
      ) => Promise<ApiResult<unknown> | null>,
    ) => {
      const expected = open?.session === session ? open.openedDraft : null;
      setOpen((o) => (o?.session === session ? { ...o, saving: true } : o));
      const res = await save(expected);
      setOpen((o) => {
        if (o?.session !== session) return o;
        return attemptSettled(res) ? null : { ...o, saving: false };
      });
      return res;
    },
    [open, session],
  );

  // WHY derived here, for every reload at once: the editor copies the show
  // into its own form state when it opens, so after any reload that brings
  // a newer live version (a rebuild, a 409, another admin's publish) or a
  // draft someone else saved, its values describe a list that is gone and
  // saving them would undo that change. Not while its own save is out: that
  // save is what changes the draft. Publish, restore and discard read their
  // content from the current props on every render, so only the editor
  // goes stale.
  const stale =
    open?.dialog.kind === "editor" &&
    !open.saving &&
    (open.openedOn !== liveVersion || open.openedDraft !== draftToken);

  return {
    dialog: open?.dialog ?? null,
    session,
    stale,
    error: open?.error ?? null,
    show,
    close,
    settle,
    saveFrom,
  };
}
