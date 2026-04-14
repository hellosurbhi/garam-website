/** A single option in the city autocomplete, pre-normalised for fast search scoring. */
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

/**
 * Strip diacritics, lowercase, and collapse non-alphanumeric characters to single spaces.
 * Used to produce consistent search keys for city matching.
 */
export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Find the first `CitySearchOption` whose normalised label or city matches `value`.
 * Returns `null` if no match is found or if `value` normalises to an empty string.
 */
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
