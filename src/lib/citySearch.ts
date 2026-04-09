import { citiesIndex } from "@/data/cities";

export interface CitySearchOption {
  value: string;
  label: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  searchText: string;
  boost: number;
}

let cityOptionsPromise: Promise<CitySearchOption[]> | null = null;

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createOption(params: {
  city: string;
  state?: string;
  country: string;
  countryCode: string;
  boost?: number;
}): CitySearchOption {
  const city = params.city.trim();
  const state = (params.state ?? "").trim();
  const country = params.country.trim();
  const parts = [city, state, country].filter(Boolean);

  return {
    value: parts.join(", "),
    label: parts.join(", "),
    city,
    state,
    country,
    countryCode: params.countryCode,
    searchText: normalize(parts.join(" ")),
    boost: params.boost ?? 0,
  };
}

export async function loadCityOptions(): Promise<CitySearchOption[]> {
  if (!cityOptionsPromise) {
    cityOptionsPromise = import("country-state-city").then(
      ({ Country, State, City }) => {
        const countryMap = new Map(
          Country.getAllCountries().map((country) => [
            country.isoCode,
            country.name,
          ]),
        );
        const cityMap = new Map<string, CitySearchOption>();

        for (const country of Country.getAllCountries()) {
          const states = State.getStatesOfCountry(country.isoCode);

          if (states.length === 0) {
            for (const city of City.getCitiesOfCountry(country.isoCode) ?? []) {
              const option = createOption({
                city: city.name,
                country: country.name,
                countryCode: country.isoCode,
              });
              cityMap.set(
                `${normalize(option.city)}|${normalize(option.state)}|${option.countryCode}`,
                option,
              );
            }
            continue;
          }

          for (const state of states) {
            for (const city of City.getCitiesOfState(
              country.isoCode,
              state.isoCode,
            )) {
              const option = createOption({
                city: city.name,
                state: state.name,
                country: country.name,
                countryCode: country.isoCode,
              });
              cityMap.set(
                `${normalize(option.city)}|${normalize(option.state)}|${option.countryCode}`,
                option,
              );
            }
          }
        }

        for (const siteCity of citiesIndex) {
          const countryCode = siteCity.addressCountry;
          const country =
            countryMap.get(countryCode) ?? siteCity.addressCountry ?? "";
          const option = createOption({
            city: siteCity.displayName,
            state: siteCity.addressRegion,
            country,
            countryCode,
            boost: siteCity.status === "active" ? 40 : 20,
          });
          const key = `${normalize(option.city)}|${normalize(option.state)}|${option.countryCode}`;
          const existing = cityMap.get(key);
          cityMap.set(
            key,
            existing ? { ...existing, boost: option.boost } : option,
          );
        }

        return Array.from(cityMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        );
      },
    );
  }

  return cityOptionsPromise;
}

function scoreCityOption(option: CitySearchOption, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return option.boost;

  const city = normalize(option.city);
  const label = normalize(option.label);

  if (city === normalizedQuery) return 1000 + option.boost;
  if (label === normalizedQuery) return 950 + option.boost;
  if (city.startsWith(normalizedQuery)) return 900 + option.boost;
  if (label.startsWith(normalizedQuery)) return 850 + option.boost;
  if (city.includes(normalizedQuery)) return 700 + option.boost;
  if (label.includes(normalizedQuery)) return 650 + option.boost;
  return option.boost;
}

export function searchCityOptions(
  query: string,
  options: CitySearchOption[],
  limit: number = 5,
): CitySearchOption[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [...options]
      .sort((a, b) => b.boost - a.boost || a.label.localeCompare(b.label))
      .slice(0, limit);
  }

  return [...options]
    .map((option) => ({
      option,
      score: scoreCityOption(option, normalizedQuery),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.option.boost - a.option.boost ||
        a.option.label.localeCompare(b.option.label),
    )
    .slice(0, limit)
    .map(({ option }) => option);
}

export function resolveCityOption(
  value: string,
  options: CitySearchOption[],
): CitySearchOption | null {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return null;

  return (
    options.find(
      (option) =>
        normalize(option.label) === normalizedValue ||
        normalize(option.city) === normalizedValue,
    ) ?? null
  );
}
