export const prerender = false;

import type { APIRoute } from "astro";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";
import { addKitSubscriber, type KitSubscriberFields } from "@/lib/kit";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { alertOps } from "@/lib/opsAlert";

interface FirestoreStringValue {
  stringValue: string;
}

interface FirestoreDocument {
  name: string;
  fields: Record<string, { stringValue?: string } | unknown>;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

function str(
  fields: Record<string, { stringValue?: string } | unknown>,
  key: string,
): string {
  const f = fields[key];
  if (f && typeof f === "object" && "stringValue" in (f as object)) {
    return (f as FirestoreStringValue).stringValue ?? "";
  }
  return "";
}

export const POST: APIRoute = async ({ request }) => {
  // Rate limit before secret comparison so the guard also throttles
  // brute-force attempts against the bearer secret.
  const limited = await enforceRateLimit(request, RATE_LIMITS.syncLeadsToKit);
  if (limited) return limited;

  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response(
      JSON.stringify({ error: "CRON_SECRET not configured" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let synced = 0;
  let errors = 0;
  let pageToken: string | undefined;

  let accessToken: string;
  try {
    accessToken = await getFirestoreAccessToken();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[sync-leads-to-kit] Firestore auth failed:", detail);
    await alertOps({
      flow: "ops",
      stage: "kit_sync_auth",
      errorMessage: detail.slice(0, 2000),
    });
    return new Response(JSON.stringify({ error: "Firestore auth failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads`,
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[sync-leads-to-kit] Failed to list leads:", body);
      await alertOps({
        flow: "ops",
        stage: "kit_sync_list",
        errorMessage: body.slice(0, 2000),
      });
      return new Response(JSON.stringify({ error: "Failed to list leads" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = (await res.json()) as FirestoreListResponse;
    const docs = data.documents ?? [];

    await Promise.all(
      docs.map(async (doc) => {
        const f = doc.fields;
        const email = str(f, "email");
        if (!email) return;

        const city = str(f, "city");
        const sourcePage = str(f, "sourcePage");
        const landingPage = str(f, "landingPage");
        const utmSource = str(f, "utmSource");
        const utmMedium = str(f, "utmMedium");
        const utmCampaign = str(f, "utmCampaign");

        const tags: string[] = ["website-lead", "backfill"];
        if (city) tags.push(city.toLowerCase().replace(/\s+/g, "-"));
        if (utmSource) tags.push(utmSource.toLowerCase());

        const fields: KitSubscriberFields = {};
        if (city) fields.city = city;
        if (sourcePage) fields.source_page = sourcePage;
        if (landingPage) fields.landing_page = landingPage;
        if (utmSource) fields.utm_source = utmSource;
        if (utmMedium) fields.utm_medium = utmMedium;
        if (utmCampaign) fields.utm_campaign = utmCampaign;

        try {
          await addKitSubscriber(email, tags, fields);
          synced++;
        } catch {
          errors++;
        }
      }),
    );

    pageToken = data.nextPageToken;
  } while (pageToken);

  if (errors > 0) {
    // Kit sync lag is recoverable, but a whole run of errors means leads are
    // not reaching the CRM; one summary page per run.
    await alertOps({
      flow: "ops",
      stage: "kit_sync",
      errorMessage: `${errors} of ${errors + synced} lead syncs to Kit failed this run.`,
    });
  }

  return new Response(JSON.stringify({ ok: true, synced, errors }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
