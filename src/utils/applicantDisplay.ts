import type { Application } from "@/types/application";
import { formatLocation } from "@/utils/locationDisplay";

/**
 * Admin display helpers for applications that may be partial. A Draft is saved
 * as the person types, so any form field can be missing; every admin surface
 * renders through these instead of touching the raw fields.
 */
export const UNNAMED_APPLICANT = "Unnamed applicant";

export function applicantName(app: Application): string {
  return app.name?.trim() || UNNAMED_APPLICANT;
}

/**
 * "29 · Woman · Brooklyn, NY" with any missing piece left out. An application
 * under 18 is saved (never lost) and carries a visible UNDER 18 flag so it is
 * not treated as eligible.
 */
export function applicantSummary(app: Application): string {
  return [
    app.age,
    app.gender,
    formatLocation(app),
    app.ageUnder18 ? "UNDER 18" : "",
  ]
    .filter((part) => part !== undefined && part !== "")
    .join(" · ");
}

/** Instagram handle without the leading @; empty when the draft has none. */
export function applicantHandle(app: Application): string {
  return (app.instagram ?? "").replace(/^@/, "");
}
