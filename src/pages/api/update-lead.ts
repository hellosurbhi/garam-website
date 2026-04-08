import type { APIRoute } from "astro";

interface UpdatePayload {
  id: string;
  phone: string;
}

export const POST: APIRoute = async ({ request }) => {
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

  if (!body.id || !body.phone) {
    return new Response(JSON.stringify({ error: "id and phone required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads/${body.id}?updateMask.fieldPaths=phone`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: { phone: { stringValue: body.phone } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: "Failed to update lead", detail: errText }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
