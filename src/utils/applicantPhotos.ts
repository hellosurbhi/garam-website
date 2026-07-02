import type { Application } from "@/types/application";

/** Returns all photos for an applicant, handling both legacy single-photo and new multi-photo records. */
export function getApplicantPhotos(app: Application): string[] {
  if (app.photoUrls && app.photoUrls.length > 0) return app.photoUrls;
  if (app.photoUrl) return [app.photoUrl];
  return [];
}
