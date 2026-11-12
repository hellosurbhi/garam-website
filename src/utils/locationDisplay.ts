import type { Application } from "@/types/application";

/**
 * Return a human-readable location string for an applicant.
 * Produces "City, State" when a state is present, otherwise just "City".
 * Empty when the applicant (a partial draft) has no city yet.
 */
export function formatLocation(app: Application): string {
  const city = app.city ?? "";
  if (app.state && city) return `${city}, ${app.state}`;
  return city;
}
