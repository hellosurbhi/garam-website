import { useCallback, useEffect, useState } from "react";
import { loadCityOptions, type CitySearchOption } from "@/lib/citySearch";

export function useCitySearch(shouldLoad: boolean = true) {
  const [options, setOptions] = useState<CitySearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const loadedOptions = await loadCityOptions();
        if (cancelled) return;
        setOptions(loadedOptions);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [attempt, shouldLoad]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { options, loading, failed, retry };
}
