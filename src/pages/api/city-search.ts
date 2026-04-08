import type { APIRoute } from "astro";
import {
  loadCityOptions,
  resolveCityOption,
  searchCityOptions,
} from "@/lib/citySearch";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const options = await loadCityOptions();
    const exact = resolveCityOption(query, options);
    const results = exact
      ? [exact, ...searchCityOptions(query, options, 5).filter((o) => o.value !== exact.value)].slice(0, 5)
      : searchCityOptions(query, options, 5);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to search cities" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
