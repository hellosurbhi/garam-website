import type { APIRoute } from "astro";
import { addKitSubscriber, type KitSubscriberFields } from "@/lib/kit";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { LeadPayloadSchema } from "@/lib/schemas";
import { issueLeadToken } from "@/lib/leadToken";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";

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
  accessToken: string,
): Promise<Response> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(8000),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.captureLead);
  if (limited) return limited;

  const parsed = await parseJsonRequest(request, LeadPayloadSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  if (body.company) {
    // Silently succeed so basic bots do not learn the honeypot field name.
    return jsonResponse({ ok: true });
  }

  const projectId = getFirebaseProjectId();
  if (!projectId) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const email = body.email.toLowerCase();
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
    const accessToken = await getFirestoreAccessToken();
    let res = await createLeadDocument(projectId, fields, accessToken);

    if (!res.ok && (fields.fbclid || fields.gclid)) {
      const fallbackFields = { ...fields };
      delete fallbackFields.fbclid;
      delete fallbackFields.gclid;
      res = await createLeadDocument(projectId, fallbackFields, accessToken);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[capture-lead] Firestore write failed:", errText);
      return jsonResponse({ error: "Failed to save lead" }, 500);
    }

    const doc = (await res.json()) as { name?: string };
    const docId = doc.name?.split("/").pop() ?? "";
    if (!docId) {
      console.error("[capture-lead] Missing docId in Firestore response");
      return jsonResponse({ error: "Failed to create lead" }, 500);
    }

    const updateToken = issueLeadToken(docId);

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

    return jsonResponse({
      ok: true,
      id: docId,
      ...(updateToken ? { updateToken } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[capture-lead] Firestore request timed out (5s)");
      return jsonResponse({ error: "Upstream timeout" }, 503);
    }
    return jsonResponse({ error: "Server error" }, 500);
  }
};
