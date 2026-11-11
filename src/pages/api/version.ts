import type { APIRoute } from "astro";
export const prerender = false;
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ commit: import.meta.env.BUILD_COMMIT_SHA }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
