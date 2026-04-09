import type { APIRoute } from "astro";
import { createHmac } from "crypto";
import { verifyIdToken } from "@/lib/verifyToken";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request }) => {
  const uid = await verifyIdToken(
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

  const { showDate } = (await request.json()) as { showDate?: string };
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
  const host = request.headers.get("host") ?? "garammasaladating.com";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const url = `${protocol}://${host}/contestant-prep?date=${showDate}&sig=${sig}`;

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
