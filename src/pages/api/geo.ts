import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const headers = request.headers;

  // Vercel IP headers are absent in local dev — return a plausible stub so
  // attribution flows can be tested without a live deployment.
  if (import.meta.env.DEV) {
    return new Response(
      JSON.stringify({
        city: "New York",
        region: "NY",
        country: "US",
        latitude: "40.7128",
        longitude: "-74.0060",
        timezone: "America/New_York",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

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
