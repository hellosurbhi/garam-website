import { useState, useEffect, useMemo } from "react";

type SelectOption = { value: string; label: string };

interface GeoModule {
  Country: typeof import("country-state-city").Country;
  State: typeof import("country-state-city").State;
  City: typeof import("country-state-city").City;
}

export function useGeoData(countryCode: string, stateCode: string) {
  const [geo, setGeo] = useState<GeoModule | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("country-state-city")
      .then((mod) => {
        if (!cancelled) {
          setGeo({ Country: mod.Country, State: mod.State, City: mod.City });
        }
      })
      .catch(() => {
        if (!cancelled) setGeoFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

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

  return { loading: !geo && !geoFailed, failed: geoFailed, countryOptions, stateOptions, cityOptions };
}
