/**
 * City data aggregator.
 * Imports all regional city files and exports a unified record.
 */
export type { CityData, CityCta, CityRegion } from "./types";
import type { CityData, CityRegion } from "./types";
import { activeCities } from "./active";
import { usNortheastCities } from "./us-northeast";
import { usSoutheastCities } from "./us-southeast";
import { usMidwestCities } from "./us-midwest";
import { usSouthTexasCities } from "./us-south-texas";
import { usWestCities } from "./us-west";
import { canadaCities } from "./canada";
import { indiaCities } from "./india";
import { ukCities } from "./uk";
import { australiaCities } from "./australia";
import { europeCities } from "./europe";
import { southeastAsiaCities } from "./southeast-asia";
import { eastAsiaCities } from "./east-asia";
import { internationalOtherCities } from "./international-other";

/** All cities keyed by slug */
export const cities: Record<string, CityData> = {
  ...activeCities,
  ...usNortheastCities,
  ...usSoutheastCities,
  ...usMidwestCities,
  ...usSouthTexasCities,
  ...usWestCities,
  ...canadaCities,
  ...indiaCities,
  ...ukCities,
  ...australiaCities,
  ...europeCities,
  ...southeastAsiaCities,
  ...eastAsiaCities,
  ...internationalOtherCities,
};

/** Region display order for the hub page */
const REGION_ORDER: CityRegion[] = [
  "US Northeast",
  "US Southeast",
  "US Midwest",
  "US South & Texas",
  "US West",
  "Canada",
  "India",
  "United Kingdom",
  "Australia",
  "Europe",
  "Southeast Asia",
  "East Asia",
  "Africa",
  "Pacific Islands",
  "Caribbean",
];

/**
 * Cities grouped by region. Active cities sort first within each group.
 */
export function citiesByRegion(): { region: CityRegion; cities: CityData[] }[] {
  const grouped = new Map<CityRegion, CityData[]>();
  for (const region of REGION_ORDER) {
    grouped.set(region, []);
  }
  for (const city of Object.values(cities)) {
    const list = grouped.get(city.region);
    if (list) {
      list.push(city);
    } else {
      grouped.set(city.region, [city]);
    }
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }
  return REGION_ORDER
    .filter((r) => {
      const list = grouped.get(r);
      return list !== undefined && list.length > 0;
    })
    .map((region) => ({ region, cities: grouped.get(region)! }));
}

/**
 * Flat ordered list: active first, then US, then India, then rest.
 */
export const citiesIndex: CityData[] = Object.values(cities).sort((a, b) => {
  if (a.status === "active" && b.status !== "active") return -1;
  if (b.status === "active" && a.status !== "active") return 1;
  const aUS = a.addressCountry === "US";
  const bUS = b.addressCountry === "US";
  if (aUS && !bUS) return -1;
  if (bUS && !aUS) return 1;
  const aIN = a.addressCountry === "IN";
  const bIN = b.addressCountry === "IN";
  if (aIN && !bIN) return -1;
  if (bIN && !aIN) return 1;
  return a.displayName.localeCompare(b.displayName);
});

export function getCityBySlug(slug: string): CityData | undefined {
  return cities[slug];
}
