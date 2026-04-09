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

export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
