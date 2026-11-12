export const prerender = false;

import type { APIRoute } from "astro";
import {
  adminJsonRoute,
  saveDraft,
  saveDraftBodySchema,
} from "@/lib/eventsAdmin.server";

// Save the shared Shows draft (issue 337).
// Body: { snapshot, basedOnVersion, expectedDraftUpdateTime }.
// WHY both verbs: PUT is the accurate one (the draft is one document
// replaced whole); POST runs the same handler because the issue 337 plan
// names both, and one shared handler means they can never diverge.
const save = adminJsonRoute("events_draft", saveDraftBodySchema, saveDraft);

export const PUT: APIRoute = save;
export const POST: APIRoute = save;
