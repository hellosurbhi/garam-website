export const prerender = false;

import type { APIRoute } from "astro";
import {
  adminJsonRoute,
  rollbackBodySchema,
  rollbackTo,
} from "@/lib/eventsAdmin.server";

// Restore an earlier version as a new live version and reset the draft to it
// (issue 337). Body: { targetVersion, expectedVersion, note }.
export const POST: APIRoute = adminJsonRoute(
  "events_rollback",
  rollbackBodySchema,
  rollbackTo,
);
