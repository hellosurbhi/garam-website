import { SHOWS_LOAD } from "@/data/adminShows";
import ShowsWorkspace from "./ShowsWorkspace";
import { useShowsAdmin } from "./useShowsAdmin";
import styles from "./ShowsTab.module.css";

/** The admin Shows tab (issue 337): the load states around the workspace. */
export default function ShowsTab() {
  const admin = useShowsAdmin();
  const { load } = admin;

  if (load.kind === "loading") {
    return (
      <p className={styles.loadingState} role="status">
        {SHOWS_LOAD.loading}
      </p>
    );
  }
  if (load.kind === "denied") {
    return (
      <p className={styles.errorState} role="alert">
        {SHOWS_LOAD.denied}
      </p>
    );
  }
  if (load.kind === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{load.message}</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void admin.reload()}
        >
          {SHOWS_LOAD.retry}
        </button>
      </div>
    );
  }
  return (
    <>
      <ShowsWorkspace admin={admin} data={load.data} />
      {admin.toast && (
        <p
          className={styles.toast}
          role="status"
          data-ok={String(admin.toast.ok)}
        >
          {admin.toast.msg}
        </p>
      )}
    </>
  );
}
