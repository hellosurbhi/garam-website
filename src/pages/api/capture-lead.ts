import type { APIRoute } from "astro";
import { validateEmail } from "@/utils/validateEmail";

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
  geoLatitude?: number | string;
  geoLongitude?: number | string;
  geoTimezone?: string;
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
  const fields: Record<string, { stringValue?: string; doubleValue?: number }> =
    {
      email: { stringValue: email },
      createdAt: { stringValue: now },
    };

  // Add optional fields
  if (body.phone) fields.phone = { stringValue: body.phone };
  if (body.city) fields.city = { stringValue: body.city };
  if (body.source) fields.source = { stringValue: body.source };
  if (body.sourcePage) fields.sourcePage = { stringValue: body.sourcePage };
  if (body.landingPage) fields.landingPage = { stringValue: body.landingPage };
  if (body.referrerHost)
    fields.referrerHost = { stringValue: body.referrerHost };
  if (body.utmSource) fields.utmSource = { stringValue: body.utmSource };
  if (body.utmMedium) fields.utmMedium = { stringValue: body.utmMedium };
  if (body.utmCampaign) fields.utmCampaign = { stringValue: body.utmCampaign };
  if (body.utmContent) fields.utmContent = { stringValue: body.utmContent };
  if (body.utmTerm) fields.utmTerm = { stringValue: body.utmTerm };
  if (body.sourceCitySlug)
    fields.sourceCitySlug = { stringValue: body.sourceCitySlug };
  if (body.fbclid) fields.fbclid = { stringValue: body.fbclid };
  if (body.gclid) fields.gclid = { stringValue: body.gclid };
  if (body.posthogDistinctId)
    fields.posthogDistinctId = { stringValue: body.posthogDistinctId };
  const geoCity =
    typeof body.geoCity === "string" ? body.geoCity.trim().slice(0, 100) : "";
  if (geoCity) fields.geoCity = { stringValue: geoCity };
  const geoRegion =
    typeof body.geoRegion === "string"
      ? body.geoRegion.trim().slice(0, 100)
      : "";
  if (geoRegion) fields.geoRegion = { stringValue: geoRegion };
  const geoCountry =
    typeof body.geoCountry === "string"
      ? body.geoCountry.trim().slice(0, 100)
      : "";
  if (geoCountry) fields.geoCountry = { stringValue: geoCountry };
  const geoTimezone =
    typeof body.geoTimezone === "string"
      ? body.geoTimezone.trim().slice(0, 100)
      : "";
  if (geoTimezone) fields.geoTimezone = { stringValue: geoTimezone };
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
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

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
