import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const headers = request.headers;
  const geo = {
    city: headers.get("x-vercel-ip-city") ?? undefined,
    region: headers.get("x-vercel-ip-country-region") ?? undefined,
    country: headers.get("x-vercel-ip-country") ?? undefined,
    timezone: headers.get("x-vercel-ip-timezone") ?? undefined,
  };

  return new Response(JSON.stringify(geo), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=3600",
    },
  });
};
