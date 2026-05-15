import type { APIRoute } from "astro";
import { validateEmail } from "@/utils/validateEmail";

export const prerender = false;

interface LeadPayload {
  email: string;
  phone?: string;
  city?: string;
  source?: string;
  sourcePage?: string;
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
  sourceCitySlug?: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
  geoLatitude?: number | string;
  geoLongitude?: number | string;
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

async function createLeadDocument(
  projectId: string,
  fields: FirestoreFields,
): Promise<Response> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

export const POST: APIRoute = async ({ request }) => {
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
  const lat =
    typeof body.geoLatitude === "number"
      ? body.geoLatitude
      : Number(String(body.geoLatitude ?? "").trim());
  if (Number.isFinite(lat) && lat >= -90 && lat <= 90) {
    fields.geoLatitude = { doubleValue: lat };
  }
  const lng =
    typeof body.geoLongitude === "number"
      ? body.geoLongitude
      : Number(String(body.geoLongitude ?? "").trim());
  if (Number.isFinite(lng) && lng >= -180 && lng <= 180) {
    fields.geoLongitude = { doubleValue: lng };
  }

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
      return new Response(
        JSON.stringify({ error: "Failed to save lead", detail: errText }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const doc = await res.json();
    // Extract document ID from the name field (projects/.../documents/leads/DOC_ID)
    const docId = doc.name?.split("/").pop() ?? "";

    return new Response(JSON.stringify({ ok: true, id: docId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
