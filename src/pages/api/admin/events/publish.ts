export const prerender = false;

import type { APIRoute } from "astro";
import {
  adminJsonRoute,
  publishBodySchema,
  publishDraft,
} from "@/lib/eventsAdmin.server";

// Publish the shared draft as the next live version, then rebuild the site
// (issue 337). Body: { expectedVersion, expectedDraftUpdateTime, note }.
export const POST: APIRoute = adminJsonRoute(
  "events_publish",
  publishBodySchema,
  publishDraft,
);
