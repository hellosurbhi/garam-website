import type { APIRoute } from "astro";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isLeadTokenEnabled, verifyLeadToken } from "@/lib/leadToken";

export const prerender = false;

interface UpdatePayload {
  id?: string;
  token?: string;
  phone: string;
}

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.updateLead);
  if (limited) return limited;

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Invalid content type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: UpdatePayload;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phone =
    typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : "";
  if (!phone) {
    return new Response(JSON.stringify({ error: "phone required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ownership proof: when LEAD_UPDATE_SECRET is configured, the doc id must
  // come from a signed token issued by capture-lead; a caller-supplied id is
  // ignored. When the secret is unset the legacy doc-id path stays active so
  // deploys are safe before the env var exists (firestore.rules bounds that
  // path to the phone field only).
  let id: string;
  if (isLeadTokenEnabled()) {
    const verified =
      typeof body.token === "string" ? verifyLeadToken(body.token) : null;
    if (!verified) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired update token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    id = verified;
  } else {
    id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
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

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads/${encodeURIComponent(id)}?updateMask.fieldPaths=phone`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: { phone: { stringValue: phone } },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[update-lead] Firestore update failed:", errText);
      return new Response(JSON.stringify({ error: "Failed to update lead" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
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
