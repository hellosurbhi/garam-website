import type { Application } from "@/types/application";

/**
 * Return a human-readable location string for an applicant.
 * Produces "City, State" when a state is present, otherwise just "City".
 */
export function formatLocation(app: Application): string {
  if (app.state) return `${app.city}, ${app.state}`;
  return app.city;
}
