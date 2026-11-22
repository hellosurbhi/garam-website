// WHY a module of its own: src/data/events.ts reaches browser bundles (the
// apply success panel and the admin casting pickers), so it must not import
// ./eventsSnapshot at runtime, which would ship zod to every visitor.
// eventsSnapshot.ts re-exports this for the server-side callers.

/** Default per-event slug: stable, unique, and human-readable in a URL. */
export function buildEventSlug(citySlug: string, isoDate?: string): string {
  return isoDate ? `${citySlug}-${isoDate}` : `${citySlug}-tba`;
}
