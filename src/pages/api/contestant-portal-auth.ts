import type { APIRoute } from "astro";
import { jsonResponse } from "@/lib/http";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  await request.body?.cancel();
  return jsonResponse(
    {
      error:
        "This legacy contestant portal auth endpoint has been retired. Use /contestant-portal packet links.",
    },
    410,
  );
};
