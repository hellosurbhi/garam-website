import type { APIRoute } from "astro";
import { createHmac } from "crypto";
import { verifyAdminToken } from "@/lib/verifyToken";

export const prerender = false;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request }) => {
  // Admin-only: matches the other privileged routes. Any authenticated Firebase
  // session (including anonymous apply-form sessions) must not mint prep links.
  const uid = await verifyAdminToken(
    request.headers.get("authorization") ?? undefined,
  );
  if (!uid) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const salt = import.meta.env.CONTESTANT_PREP_SALT;
  if (!salt) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { showDate?: string };
  try {
    body = (await request.json()) as { showDate?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { showDate } = body;
  if (
    !showDate ||
    typeof showDate !== "string" ||
    !ISO_DATE_RE.test(showDate)
  ) {
    return new Response(
      JSON.stringify({ error: "showDate (YYYY-MM-DD) is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const sig = createHmac("sha256", salt).update(showDate).digest("hex");
  const origin = import.meta.env.SITE ?? "https://garammasaladating.com";
  const url = `${origin}/contestant-prep?date=${showDate}&sig=${sig}`;

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
