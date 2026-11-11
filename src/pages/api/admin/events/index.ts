export const prerender = false;

import type { APIRoute } from "astro";
import { loadEventsAdmin, runAdminRoute } from "@/lib/eventsAdmin.server";
import { jsonResponse } from "@/lib/http";

// Admin Shows tab: the live version, the shared draft with its pending
// changes, and the last 20 versions (issue 337).
export const GET: APIRoute = (context) =>
  runAdminRoute(context, "events_load", async () =>
    jsonResponse(await loadEventsAdmin()),
  );
