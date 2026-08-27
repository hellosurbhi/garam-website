import { useEffect, useMemo, useState } from "react";
import type { Application } from "@/types/application";
import {
  getApplicantPhotoSources,
  type ApplicantPhotoSource,
} from "@/utils/applicantPhotos";
import { getFirebaseStorage } from "@/lib/firebase";

// WHY: photo reads are admin-only in storage.rules and applications store
// Storage paths, not URLs (a July 2026 outage came from the client calling
// getDownloadURL). getBlob() downloads through the admin's authenticated
// session without minting long-lived tokened URLs at all. Resolved object
// URLs are cached for the whole admin session because the card grid and the
// modal would otherwise re-download the same 15 MB originals on every mount;
// entries are deliberately never revoked (bounded by photos actually viewed).
const objectUrlCache = new Map<string, Promise<string>>();

function resolvePath(path: string): Promise<string> {
  let cached = objectUrlCache.get(path);
  if (!cached) {
    cached = (async () => {
      const [{ ref, getBlob }, storage] = await Promise.all([
        import("firebase/storage"),
        getFirebaseStorage(),
      ]);
      const blob = await getBlob(ref(storage, path));
      return URL.createObjectURL(blob);
    })();
    // A failed download must not poison the cache for retries on next mount.
    cached.catch(() => objectUrlCache.delete(path));
    objectUrlCache.set(path, cached);
  }
  return cached;
}

interface ApplicantPhotosState {
  /** Displayable img src values (object URLs for paths, legacy URLs as-is). */
  photos: string[];
  /** Total photo count, known before any download finishes. */
  count: number;
  loading: boolean;
}

interface ResolvedBatch {
  /** The exact sources batch these urls were resolved for (identity check). */
  batch: ApplicantPhotoSource[];
  urls: string[];
}

/**
 * Resolves an applicant's photos to displayable URLs.
 * `limit` caps how many are downloaded (cards only need the first photo).
 */
export function useApplicantPhotos(
  app: Application,
  limit?: number,
): ApplicantPhotosState {
  const sources = useMemo(() => getApplicantPhotoSources(app), [app]);
  const wanted = useMemo(
    () => (limit === undefined ? sources : sources.slice(0, limit)),
    [sources, limit],
  );

  // Legacy URL-only applicants need no async work; derive directly so the
  // effect never sets state synchronously.
  const immediate = useMemo(
    () =>
      wanted.every((s) => s.kind === "url") ? wanted.map((s) => s.value) : null,
    [wanted],
  );

  const [resolved, setResolved] = useState<ResolvedBatch | null>(null);

  useEffect(() => {
    if (immediate) return;
    let cancelled = false;
    void Promise.all(
      wanted.map((source) =>
        source.kind === "url"
          ? Promise.resolve(source.value)
          : resolvePath(source.value).catch(() => null),
      ),
    ).then((urls) => {
      if (cancelled) return;
      setResolved({
        batch: wanted,
        urls: urls.filter((u): u is string => u !== null),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, immediate]);

  const upToDate = resolved !== null && resolved.batch === wanted;
  return {
    photos: immediate ?? (upToDate ? resolved.urls : []),
    count: sources.length,
    loading: immediate === null && !upToDate,
  };
}
