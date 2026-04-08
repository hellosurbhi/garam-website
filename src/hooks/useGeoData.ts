import { useState, useEffect, useMemo, useCallback } from "react";

type SelectOption = { value: string; label: string };

interface GeoModule {
  Country: typeof import("country-state-city").Country;
  State: typeof import("country-state-city").State;
  City: typeof import("country-state-city").City;
}

const GEO_TIMEOUT_MS = 5000;

export function useGeoData(countryCode: string, stateCode: string, shouldLoad: boolean = true) {
  const [geo, setGeo] = useState<GeoModule | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;

    setGeoFailed(false);
    setGeo(null);

    const timeout = setTimeout(() => {
      if (!cancelled) setGeoFailed(true);
    }, GEO_TIMEOUT_MS);

    import("country-state-city")
      .then((mod) => {
        if (!cancelled) {
          clearTimeout(timeout);
          setGeo({ Country: mod.Country, State: mod.State, City: mod.City });
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeout);
          setGeoFailed(true);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [attempt, shouldLoad]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const countryOptions = useMemo<SelectOption[]>(
    () => geo ? geo.Country.getAllCountries().map((c) => ({ value: c.isoCode, label: c.name })) : [],
    [geo],
  );

  const stateOptions = useMemo<SelectOption[]>(
    () => geo && countryCode
      ? geo.State.getStatesOfCountry(countryCode).map((s) => ({ value: s.isoCode, label: s.name }))
      : [],
    [geo, countryCode],
  );

  const cityOptions = useMemo<SelectOption[]>(
    () => geo && countryCode && stateCode
      ? geo.City.getCitiesOfState(countryCode, stateCode).map((c) => ({ value: c.name, label: c.name }))
      : [],
    [geo, countryCode, stateCode],
  );

  return { loading: !geo && !geoFailed, failed: geoFailed, retry, countryOptions, stateOptions, cityOptions };
}
