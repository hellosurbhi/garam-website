import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyAdminIdentity } from "@/lib/verifyToken";
import { sendMail } from "@/lib/zohoMailer";
import { fsGet } from "@/lib/firestoreRest";
import { schedulingFollowup } from "@/data/emails";

export const prerender = false;

const BodySchema = z.object({
  applicationId: z.string().min(1).max(200),
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

  let body: { applicationId: string };
  try {
    const raw = await request.json();
    body = BodySchema.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const calUrl = import.meta.env.CAL_INTERVIEW_URL;
  if (!calUrl) {
    return new Response(
      JSON.stringify({ error: "CAL_INTERVIEW_URL not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const doc = await fsGet(`applications/${body.applicationId}`);
  if (!doc) {
    return new Response(JSON.stringify({ error: "Application not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const recipientEmail = typeof doc.email === "string" ? doc.email : null;
  const recipientName = typeof doc.name === "string" ? doc.name : "there";

  if (!recipientEmail) {
    return new Response(
      JSON.stringify({ error: "Application has no email address" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const template = schedulingFollowup(recipientName, calUrl);
  await sendMail({ to: recipientEmail, ...template });

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
