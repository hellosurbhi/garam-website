import { useCallback, useEffect, useState } from "react";
import type { CitySearchOption } from "@/lib/citySearchShared";
import { trackError } from "@/lib/analytics";

async function fetchCityOptions(query: string): Promise<CitySearchOption[]> {
  const response = await fetch(
    `/api/city-search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw new Error("Failed to search cities");
  }

  const data = (await response.json()) as { results?: CitySearchOption[] };
  return data.results ?? [];
}

export function useCitySearch(query: string, shouldLoad: boolean = true) {
  const [options, setOptions] = useState<CitySearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!shouldLoad || !query.trim()) {
      const reset = window.setTimeout(() => {
        if (cancelled) return;
        setOptions([]);
        setLoading(false);
        setFailed(false);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(reset);
      };
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const loadedOptions = await fetchCityOptions(query);
        if (cancelled) return;
        setOptions(loadedOptions);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        trackError({
          error_message: error.message,
          error_stack: (error.stack ?? "").slice(0, 2000),
          error_type: "api_error",
          component: "useCitySearch",
          api_endpoint: "/api/city-search",
        });
        setFailed(true);
        setLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attempt, query, shouldLoad]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { options, loading, failed, retry };
}
