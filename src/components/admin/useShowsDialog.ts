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
  /** Counts every opening, so a late answer can tell it is not its own. */
  session: number;
  error: string | null;
}

export function useShowsDialog(liveVersion: number, draftWriting: boolean) {
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
        session: opened.current,
        error: null,
      });
    },
    [liveVersion, draftWriting],
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

  // WHY derived here, for every reload at once: the editor copies the show
  // into its own form state when it opens, so after any reload that brings
  // a newer live version (a rebuild, a 409, another admin's publish) its
  // values describe a list that is gone and saving them would undo that
  // publish. Publish, restore and discard read their content from the
  // current props on every render, so only the editor goes stale.
  const stale = open?.dialog.kind === "editor" && open.openedOn !== liveVersion;

  return {
    dialog: open?.dialog ?? null,
    session,
    stale,
    error: open?.error ?? null,
    show,
    close,
    settle,
  };
}
