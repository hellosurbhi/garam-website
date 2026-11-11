import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { AutosaveController } from "@/lib/applyAutosave";
import {
  removeApplicationPhoto,
  uploadApplicationPhoto,
} from "@/lib/applyPhotos";
import { MAX_PHOTOS } from "./applyFormModel";

export type PhotoStatus = "uploading" | "saved" | "failed";

export interface PhotoItem {
  id: number;
  file: File;
  preview: string;
  status: PhotoStatus;
  path?: string;
  /** Draft generation the file was filed under; older than the controller's means stranded. */
  epoch?: number;
  error?: Error;
}

/**
 * Photos upload the moment they are picked, so they are filed even if the
 * person never submits. A photo is never rejected for its type or size; a
 * failed upload stays in the list (the file is still in memory) and is retried
 * at submit.
 */
export function usePhotoUploads(
  controller: AutosaveController,
  onUploadFailed: (error: Error, item: PhotoItem) => void,
) {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const nextId = useRef(1);
  const inFlight = useRef(new Set<Promise<void>>());
  const running = useRef(new Set<number>());
  const removed = useRef(new Set<number>());
  const itemsRef = useRef<PhotoItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patch = useCallback((id: number, change: Partial<PhotoItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }, []);

  const upload = useCallback(
    (item: PhotoItem) => {
      // WHY: the reset listener and settleForSubmit can both refile the same
      // photo before React re-renders its status; one upload per photo at once.
      if (running.current.has(item.id)) return;
      running.current.add(item.id);
      patch(item.id, { status: "uploading", error: undefined });
      const run = uploadApplicationPhoto(controller, item.file, item.id)
        .then((result) => {
          if (removed.current.has(item.id)) {
            // WHY: the applicant removed this photo while it was uploading,
            // so there was no path to remove then. The upload finished anyway
            // and the server attached it; take it off again.
            void removeApplicationPhoto(controller, result.path).catch(
              () => {},
            );
            return;
          }
          patch(item.id, {
            status: "saved",
            path: result.path,
            epoch: result.epoch,
          });
        })
        .catch((err: unknown) => {
          if (removed.current.has(item.id)) return;
          const error = err instanceof Error ? err : new Error(String(err));
          patch(item.id, { status: "failed", error });
          onUploadFailed(error, item);
        })
        .finally(() => {
          running.current.delete(item.id);
          inFlight.current.delete(run);
        });
      inFlight.current.add(run);
    },
    [controller, onUploadFailed, patch],
  );

  // WHY: when the draft is replaced (token expired or rotated) the photos
  // already filed belong to the old draft and the new one starts empty. The
  // files are still in memory, so file them again under the new draft.
  const refile = useCallback(() => {
    itemsRef.current
      .filter((p) => p.status === "saved" && p.epoch !== controller.epoch)
      .forEach(upload);
  }, [controller, upload]);

  useEffect(() => controller.onDraftReset(refile), [controller, refile]);

  function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_PHOTOS - itemsRef.current.length;
    const added = incoming
      .slice(0, Math.max(room, 0))
      .map<PhotoItem>((file) => ({
        id: nextId.current++,
        file,
        preview: URL.createObjectURL(file),
        status: "uploading",
      }));
    if (added.length === 0) return;
    setItems((prev) => [...prev, ...added]);
    added.forEach(upload);
  }

  function removePhoto(id: number) {
    const item = itemsRef.current.find((p) => p.id === id);
    if (!item) return;
    URL.revokeObjectURL(item.preview);
    removed.current.add(id);
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (item.path) {
      // Best effort: the stored file is kept either way.
      void removeApplicationPhoto(controller, item.path).catch(() => {});
    }
  }

  /** Wait for uploads in flight, then retry every failed one once. */
  async function settleForSubmit(): Promise<PhotoItem[]> {
    await Promise.allSettled([...inFlight.current]);
    // Re-read after a tick so a status that just landed is seen before refiling.
    await new Promise((r) => setTimeout(r, 0));
    itemsRef.current.filter((p) => p.status === "failed").forEach(upload);
    refile();
    await Promise.allSettled([...inFlight.current]);
    // State updates from the retry land after this tick; read the live list.
    await new Promise((r) => setTimeout(r, 0));
    return itemsRef.current;
  }

  function reset() {
    itemsRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    setItems([]);
  }

  useEffect(
    () => () => itemsRef.current.forEach((p) => URL.revokeObjectURL(p.preview)),
    [],
  );

  return { items, addPhotos, removePhoto, settleForSubmit, reset };
}
