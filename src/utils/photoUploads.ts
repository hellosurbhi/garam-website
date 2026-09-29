import type { UploadTask } from "firebase/storage";

const UPLOAD_CONCURRENCY = 2;
const UPLOAD_IDLE_TIMEOUT_MS = 30_000;
const UPLOAD_MAX_DURATION_MS = 180_000;

/** Keep photo decoding and uploads within a phone's memory and bandwidth. */
export async function settlePhotoUploads(
  files: File[],
  upload: (file: File, index: number) => Promise<string>,
): Promise<PromiseSettledResult<string>[]> {
  const results: PromiseSettledResult<string>[] = new Array(files.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await upload(files[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  // Wait for the remaining uploads after a failure so rollback sees every
  // object that could have been created, including the slower siblings.
  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker),
  );
  return results;
}

/** Cancel stalled transfers without cutting off a progressing cellular upload. */
export function waitForPhotoUpload(
  task: Pick<UploadTask, "on" | "cancel">,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let transferred = 0;
    let unsubscribe: () => void = () => {};

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      unsubscribe();
      if (error) reject(error);
      else resolve();
    };
    const timeout = (message: string) => {
      finish(new Error(message));
      task.cancel();
    };
    const idleTimeout = () =>
      timeout("Photo upload stopped making progress for 30 seconds");
    let idleTimer = setTimeout(idleTimeout, UPLOAD_IDLE_TIMEOUT_MS);
    const maxTimer = setTimeout(
      () => timeout("Photo upload exceeded 3 minutes"),
      UPLOAD_MAX_DURATION_MS,
    );

    unsubscribe = task.on(
      "state_changed",
      (snapshot) => {
        if (settled) return;
        if (snapshot.bytesTransferred > transferred) {
          transferred = snapshot.bytesTransferred;
          clearTimeout(idleTimer);
          idleTimer = setTimeout(idleTimeout, UPLOAD_IDLE_TIMEOUT_MS);
        }
      },
      finish,
      () => finish(),
    );
    if (settled) unsubscribe();
  });
}
