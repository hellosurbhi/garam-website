import type { APIRoute } from "astro";
import { validateEmail } from "@/utils/validateEmail";

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
  posthogDistinctId?: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
  geoLatitude?: string;
  geoLongitude?: string;
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
  const fields: Record<string, { stringValue: string }> = {
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
  if (body.posthogDistinctId)
    fields.posthogDistinctId = { stringValue: body.posthogDistinctId };
  if (body.geoCity) fields.geoCity = { stringValue: body.geoCity };
  if (body.geoRegion) fields.geoRegion = { stringValue: body.geoRegion };
  if (body.geoCountry) fields.geoCountry = { stringValue: body.geoCountry };
  if (body.geoLatitude) fields.geoLatitude = { stringValue: body.geoLatitude };
  if (body.geoLongitude)
    fields.geoLongitude = { stringValue: body.geoLongitude };
  if (body.geoTimezone) fields.geoTimezone = { stringValue: body.geoTimezone };

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
