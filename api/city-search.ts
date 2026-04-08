import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  loadCityOptions,
  resolveCityOption,
  searchCityOptions,
} from "../src/lib/citySearch.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    return res.status(200).json({ results: [] });
  }

  try {
    const options = await loadCityOptions();
    const exact = resolveCityOption(query, options);
    const results = exact
      ? [exact, ...searchCityOptions(query, options, 5).filter((option) => option.value !== exact.value)].slice(0, 5)
      : searchCityOptions(query, options, 5);

    return res.status(200).json({ results });
  } catch {
    return res.status(500).json({ error: "Failed to search cities" });
  }
}
