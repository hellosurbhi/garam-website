import type { Application } from "@/types/application";

/**
 * A displayable applicant photo, in one of two shapes:
 * - `path`: a Firebase Storage path (canonical since July 2026). Photo reads
 *   are admin-only, so paths must be resolved by an authenticated admin
 *   session (see useApplicantPhotos).
 * - `url`: a legacy tokened download URL stored on older documents; usable
 *   directly as an img src.
 */
export type ApplicantPhotoSource =
  | { kind: "path"; value: string }
  | { kind: "url"; value: string };

/** Returns all photo sources for an applicant across every historical document shape. */
export function getApplicantPhotoSources(
  app: Application,
): ApplicantPhotoSource[] {
  if (app.photoPaths && app.photoPaths.length > 0) {
    return app.photoPaths.map((value) => ({ kind: "path", value }));
  }
  if (app.photoUrls && app.photoUrls.length > 0) {
    return app.photoUrls.map((value) => ({ kind: "url", value }));
  }
  if (app.photoUrl) return [{ kind: "url", value: app.photoUrl }];
  return [];
}
