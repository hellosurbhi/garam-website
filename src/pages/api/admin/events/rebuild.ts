export const prerender = false;

import type { APIRoute } from "astro";
import { rebuildLive, runAdminRoute } from "@/lib/eventsAdmin.server";
import { jsonResponse } from "@/lib/http";

// Ask Vercel to rebuild the site from the live version, for when the rebuild
// after a publish failed or looks stuck (issue 337, R15).
export const POST: APIRoute = (context) =>
  runAdminRoute(context, "events_rebuild", async () =>
    jsonResponse(await rebuildLive()),
  );
