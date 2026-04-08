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

export function normalizeCitySearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchCityOptions(
  query: string,
  options: CitySearchOption[],
  limit: number = 5,
): CitySearchOption[] {
  const normalizedQuery = normalizeCitySearchValue(query);
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
  const normalizedValue = normalizeCitySearchValue(value);
  if (!normalizedValue) return null;

  return (
    options.find(
      (option) =>
        normalizeCitySearchValue(option.label) === normalizedValue ||
        normalizeCitySearchValue(option.city) === normalizedValue,
    ) ?? null
  );
}

function scoreCityOption(option: CitySearchOption, query: string): number {
  const city = normalizeCitySearchValue(option.city);
  const label = normalizeCitySearchValue(option.label);

  if (city === query) return 1000 + option.boost;
  if (label === query) return 950 + option.boost;
  if (city.startsWith(query)) return 900 + option.boost;
  if (label.startsWith(query)) return 850 + option.boost;
  if (city.includes(query)) return 700 + option.boost;
  if (label.includes(query)) return 650 + option.boost;
  return option.boost;
}
