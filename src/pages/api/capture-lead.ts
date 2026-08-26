import type { APIRoute } from "astro";
import { validateEmail } from "@/utils/validateEmail";
import { addKitSubscriber, type KitSubscriberFields } from "@/lib/kit";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { issueLeadToken } from "@/lib/leadToken";
import { alertOps } from "@/lib/opsAlert";

export const prerender = false;

interface LeadPayload {
  email: string;
  phone?: string;
  city?: string;
  source?: string;
  sourcePage?: string;
  sourceCitySlug?: string;
  landingPage?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  posthogDistinctId?: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
  geoTimezone?: string;
}

type FirestoreValue = { stringValue?: string; doubleValue?: number };
type FirestoreFields = Record<string, FirestoreValue>;

function normalizedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function addStringField(
  fields: FirestoreFields,
  key: string,
  value: unknown,
  maxLength: number,
) {
  const normalized = normalizedString(value, maxLength);
  if (normalized) fields[key] = { stringValue: normalized };
}

function addNumericHeaderField(
  fields: FirestoreFields,
  key: string,
  headerValue: string | null,
  min: number,
  max: number,
) {
  if (!headerValue) return;
  const value = Number(headerValue);
  if (Number.isFinite(value) && value >= min && value <= max) {
    fields[key] = { doubleValue: value };
  }
}

async function createLeadDocument(
  projectId: string,
  fields: FirestoreFields,
): Promise<Response> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(8000),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.captureLead);
  if (limited) return limited;

  // Validate content type
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Invalid content type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: LeadPayload;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate email
  const email = body.email?.trim().toLowerCase();
  if (!email || validateEmail(email)) {
    return new Response(JSON.stringify({ error: "Valid email required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build Firestore document via REST API (no firebase-admin dependency)
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

  const now = new Date().toISOString();
  const fields: FirestoreFields = {
    email: { stringValue: email },
    createdAt: { stringValue: now },
  };

  // Add optional fields
  addStringField(fields, "phone", body.phone, 20);
  addStringField(fields, "city", body.city, 100);
  addStringField(fields, "source", body.source ?? "lead-capture", 50);
  addStringField(fields, "sourcePage", body.sourcePage ?? "/", 200);
  addStringField(fields, "landingPage", body.landingPage, 200);
  addStringField(fields, "referrerHost", body.referrerHost, 255);
  addStringField(fields, "utmSource", body.utmSource, 100);
  addStringField(fields, "utmMedium", body.utmMedium, 100);
  addStringField(fields, "utmCampaign", body.utmCampaign, 150);
  addStringField(fields, "utmContent", body.utmContent, 150);
  addStringField(fields, "utmTerm", body.utmTerm, 150);
  addStringField(fields, "fbclid", body.fbclid, 500);
  addStringField(fields, "gclid", body.gclid, 500);
  addStringField(fields, "posthogDistinctId", body.posthogDistinctId, 200);
  addStringField(fields, "sourceCitySlug", body.sourceCitySlug, 100);
  addStringField(fields, "geoCity", body.geoCity, 100);
  addStringField(fields, "geoRegion", body.geoRegion, 100);
  addStringField(fields, "geoCountry", body.geoCountry, 100);
  addStringField(fields, "geoTimezone", body.geoTimezone, 100);
  // Read server-side Vercel geo headers (not sessionStorage — no CodeQL issue)
  addNumericHeaderField(
    fields,
    "geoLatitude",
    request.headers.get("x-vercel-ip-latitude"),
    -90,
    90,
  );
  addNumericHeaderField(
    fields,
    "geoLongitude",
    request.headers.get("x-vercel-ip-longitude"),
    -180,
    180,
  );

  try {
    let res = await createLeadDocument(projectId, fields);

    if (!res.ok && (fields.fbclid || fields.gclid)) {
      const fallbackFields = { ...fields };
      delete fallbackFields.fbclid;
      delete fallbackFields.gclid;
      res = await createLeadDocument(projectId, fallbackFields);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[capture-lead] Firestore write failed:", errText);
      // A 500 here is a lost lead; page with the email so the person is
      // recoverable (the client also reports, but server-side coverage does
      // not depend on the client surviving).
      await alertOps({
        flow: "lead",
        stage: "firestore_write",
        errorMessage: errText.slice(0, 2000),
        context: { email, city: body.city },
      });
      return new Response(JSON.stringify({ error: "Failed to save lead" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const doc = await res.json();
    // Extract document ID from the name field (projects/.../documents/leads/DOC_ID)
    const docId = doc.name?.split("/").pop() ?? "";

    // Sync to Kit — fire-and-forget, never blocks the response
    const kitTags: string[] = ["website-lead"];
    if (body.city) kitTags.push(body.city.toLowerCase().replace(/\s+/g, "-"));
    if (body.utmSource) kitTags.push(body.utmSource.toLowerCase());
    const kitFields: KitSubscriberFields = {};
    if (body.city) kitFields.city = body.city;
    if (body.sourcePage) kitFields.source_page = body.sourcePage;
    if (body.landingPage) kitFields.landing_page = body.landingPage;
    if (body.utmSource) kitFields.utm_source = body.utmSource;
    if (body.utmMedium) kitFields.utm_medium = body.utmMedium;
    if (body.utmCampaign) kitFields.utm_campaign = body.utmCampaign;
    addKitSubscriber(email, kitTags, kitFields).catch(() => {
      // Kit errors are already logged inside addKitSubscriber
    });

    // Ownership proof for the step-2 phone update. Null while
    // LEAD_UPDATE_SECRET is unset (feature off), in which case the key is
    // omitted and clients keep using the bare doc id.
    const updateToken = docId ? issueLeadToken(docId) : null;

    return new Response(
      JSON.stringify({
        ok: true,
        id: docId,
        ...(updateToken ? { updateToken } : {}),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    await alertOps({
      flow: "lead",
      stage: "capture_unhandled",
      errorMessage: err instanceof Error ? err.message : String(err),
      context: { email, city: body.city },
    });
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
