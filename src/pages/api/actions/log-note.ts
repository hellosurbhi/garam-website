import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyAdminIdentity } from "@/lib/verifyToken";
import { fsAdd } from "@/lib/firestoreRest";

export const prerender = false;

const BodySchema = z.object({
  applicationId: z.string().min(1).max(200),
  note: z.string().min(1).max(2000),
});

export const POST: APIRoute = async ({ request }) => {
  const identity = await verifyAdminIdentity(
    request.headers.get("authorization") ?? undefined,
  );
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { applicationId: string; note: string };
  try {
    const raw = await request.json();
    body = BodySchema.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await fsAdd(`applications/${body.applicationId}/events`, {
    type: "interview_note",
    timestamp: new Date().toISOString(),
    actor: identity.email,
    payload: { note: body.note },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
