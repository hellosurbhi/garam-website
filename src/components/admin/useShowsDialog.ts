/**
 * Which Shows dialog is open, and what went wrong in it (issue 337).
 */
import { useCallback, useState } from "react";
import type { ShowsDialog } from "./ShowsDialogs";
import { attemptSettled, failureMessage, type ApiResult } from "./showsApi";

interface OpenDialog {
  dialog: ShowsDialog;
  /** The live version when it opened. */
  openedOn: number;
}

export function useShowsDialog(liveVersion: number) {
  const [open, setOpen] = useState<OpenDialog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback(
    (dialog: ShowsDialog) => {
      setError(null);
      setOpen({ dialog, openedOn: liveVersion });
    },
    [liveVersion],
  );
  const close = useCallback(() => {
    setError(null);
    setOpen(null);
  }, []);
  /** After a publish, restore or discard: close, or say why it failed. */
  const settle = useCallback(
    (res: ApiResult<unknown> | null) => {
      if (attemptSettled(res)) close();
      else setError(failureMessage(res));
    },
    [close],
  );

  // WHY derived here, for every reload at once: the editor copies the show
  // into its own form state when it opens, so after any reload that brings
  // a newer live version (a rebuild, a 409, another admin's publish) its
  // values describe a list that is gone and saving them would undo that
  // publish. Publish, restore and discard read their content from the
  // current props on every render, so only the editor goes stale.
  const stale = open?.dialog.kind === "editor" && open.openedOn !== liveVersion;

  return { dialog: open?.dialog ?? null, stale, error, show, close, settle };
}
