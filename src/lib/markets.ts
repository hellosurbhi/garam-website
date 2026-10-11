import marketsData from "../data/markets.json";

export type MarketConfidence = "high" | "medium" | "low";
export type MarketSource = "self-reported" | "source-city" | "geo";

export interface Market {
  slug: string;
  displayName: string;
  lat: number;
  lon: number;
  radiusKm: number;
  citySlugs: string[];
  aliases: Record<string, string[]>;
}

export interface MarketInput {
  city?: string | null;
  geoCity?: string | null;
  sourceCitySlug?: string | null;
  geoLatitude?: string | number | null;
  geoLongitude?: string | number | null;
}

/**
 * `market` is null when nothing resolved. `reason` is only set in that case and
 * is what the dashboard's "needs a city" list shows, so it has to name the
 * actual obstacle rather than just saying no.
 */
export interface MarketResolution {
  market: string | null;
  confidence: MarketConfidence | null;
  source: MarketSource | null;
  reason?: string;
}

/**
 * WHY markets.json is validated instead of cast: TypeScript infers a union of
 * 30 differently-keyed `aliases` shapes from the literal, so a plain `as
 * Market[]` is rejected and `as unknown as Market[]` would assert the shape
 * without checking it. This file is hand-edited by a person adding a city, and
 * a typo there decides who gets emailed, so the import fails loudly at module
 * load rather than resolving someone into `undefined`.
 */
function parseMarkets(raw: unknown): Market[] {
  const root = raw as { markets?: unknown };
  if (!Array.isArray(root.markets))
    throw new Error("markets.json: `markets` must be an array");
  return root.markets.map((entry, i) => {
    const m = entry as Partial<Market>;
    const at = `markets.json market #${i}${m.slug ? ` (${m.slug})` : ""}`;
    if (typeof m.slug !== "string" || !m.slug)
      throw new Error(`${at}: slug must be a non-empty string`);
    if (typeof m.displayName !== "string" || !m.displayName)
      throw new Error(`${at}: displayName must be a non-empty string`);
    for (const key of ["lat", "lon", "radiusKm"] as const) {
      if (typeof m[key] !== "number" || !Number.isFinite(m[key]))
        throw new Error(`${at}: ${key} must be a finite number`);
    }
    if (m.radiusKm! <= 0) throw new Error(`${at}: radiusKm must be positive`);
    if (Math.abs(m.lat!) > 90 || Math.abs(m.lon!) > 180)
      throw new Error(`${at}: lat/lon out of range`);
    if (
      !Array.isArray(m.citySlugs) ||
      m.citySlugs.some((s) => typeof s !== "string")
    )
      throw new Error(`${at}: citySlugs must be an array of strings`);
    if (!m.aliases || typeof m.aliases !== "object" || Array.isArray(m.aliases))
      throw new Error(`${at}: aliases must be an object keyed by state`);
    for (const [state, list] of Object.entries(m.aliases)) {
      if (!/^[A-Z]{2}$/.test(state))
        throw new Error(
          `${at}: alias key "${state}" is not a two-letter state code`,
        );
      if (
        !Array.isArray(list) ||
        list.length === 0 ||
        list.some((a) => typeof a !== "string" || !a.trim())
      )
        throw new Error(
          `${at}: aliases.${state} must be a non-empty array of non-empty strings`,
        );
    }
    return m as Market;
  });
}

function parseStateRollup(
  raw: unknown,
  slugs: Set<string>,
): Record<string, string> {
  const value = (raw as { stateRollup?: unknown }).stateRollup;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("markets.json: `stateRollup` must be an object");
  for (const [state, slug] of Object.entries(value)) {
    if (!/^[A-Z]{2}$/.test(state))
      throw new Error(
        `markets.json: stateRollup key "${state}" is not a state code`,
      );
    if (typeof slug !== "string" || !slugs.has(slug))
      throw new Error(
        `markets.json: stateRollup.${state} points at unknown market "${String(slug)}"`,
      );
  }
  return value as Record<string, string>;
}

export const markets: Market[] = parseMarkets(marketsData);

export const marketBySlug: Map<string, Market> = new Map(
  markets.map((m) => [m.slug, m]),
);

if (marketBySlug.size !== markets.length) {
  throw new Error("markets.json: duplicate market slug");
}

export const stateRollup: Record<string, string> = parseStateRollup(
  marketsData,
  new Set(marketBySlug.keys()),
);

const STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DC",
  "DE",
  "FL",
  "GA",
  "HI",
  "IA",
  "ID",
  "IL",
  "IN",
  "KS",
  "KY",
  "LA",
  "MA",
  "MD",
  "ME",
  "MI",
  "MN",
  "MO",
  "MS",
  "MT",
  "NC",
  "ND",
  "NE",
  "NH",
  "NJ",
  "NM",
  "NV",
  "NY",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VA",
  "VT",
  "WA",
  "WI",
  "WV",
  "WY",
]);

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york state": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington_state: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

/**
 * decodeURIComponent throws on a lone or malformed `%`, and lead rows contain
 * real examples of both halves of that problem (`Des%20Moines` decodes fine,
 * a truncated paste does not). Returning the raw string on failure keeps a
 * bad value resolvable as text instead of turning one row into an exception.
 */
function decodeMaybe(raw: string): string {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Lowercase, strip accents and punctuation, collapse whitespace. No state handling. */
function basicNorm(raw: string | null | undefined): string {
  if (!raw) return "";
  return decodeMaybe(raw)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/[^a-z0-9/& -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedPlace {
  name: string;
  state: string | null;
}

/**
 * Splits a free-text location into a city name and a US state, handling the
 * shapes that actually appear in the lead data: "edison, nj", "los angeles ca",
 * "chicago, illinois", "washington dc / nova".
 */
export function parsePlace(raw: string | null | undefined): ParsedPlace {
  let text = basicNorm(raw);
  if (!text) return { name: "", state: null };

  // "washington dc / nova" and "raleigh/durham": keep only the first place.
  if (text.includes("/")) text = text.split("/")[0].trim();

  let state: string | null = null;
  const commaIdx = text.lastIndexOf(",");
  if (commaIdx !== -1) {
    const tail = text.slice(commaIdx + 1).trim();
    const code = tail.toUpperCase();
    if (STATE_CODES.has(code)) state = code;
    else if (STATE_NAMES[tail]) state = STATE_NAMES[tail];
    if (state) text = text.slice(0, commaIdx).trim();
  }
  if (!state) {
    const words = text.split(" ");
    if (words.length > 1) {
      const last = words[words.length - 1].toUpperCase();
      // WHY the "dc" exclusion: "washington dc" is the city's own name here, and
      // stripping the trailing token would leave the bare, genuinely ambiguous
      // "washington" (state, or the DC metro) with its disambiguator thrown away.
      if (STATE_CODES.has(last) && last !== "DC") {
        state = last;
        text = words.slice(0, -1).join(" ");
      } else {
        const twoWordTail = words.slice(-2).join(" ");
        if (STATE_NAMES[twoWordTail] && words.length > 2) {
          state = STATE_NAMES[twoWordTail];
          text = words.slice(0, -2).join(" ");
        } else if (STATE_NAMES[words[words.length - 1]] && words.length > 1) {
          state = STATE_NAMES[words[words.length - 1]];
          text = words.slice(0, -1).join(" ");
        }
      }
    }
  }
  return { name: text.replace(/,$/, "").trim(), state };
}

interface AliasEntry {
  market: string;
  state: string;
}

/**
 * alias text -> every (market, state) that claims it.
 *
 * WHY each state-suffixed alias is registered twice: markets.json spells the
 * colliding names with their state baked in ("newark ca", "hollywood fl") so a
 * human reading the file can see which one is meant, but a visitor types
 * "Newark, CA", which parsePlace splits into name "newark" plus state "CA".
 * Registering the stripped form under the same state is what connects those,
 * and it is also what makes the collision visible to the ambiguity check below
 * instead of hiding it behind two differently-spelled keys.
 */
const aliasIndex: Map<string, AliasEntry[]> = (() => {
  const index = new Map<string, AliasEntry[]>();
  const add = (alias: string, entry: AliasEntry) => {
    const key = basicNorm(alias);
    if (!key) return;
    const existing = index.get(key);
    if (!existing) {
      index.set(key, [entry]);
      return;
    }
    if (
      existing.some((e) => e.market === entry.market && e.state === entry.state)
    )
      return;
    existing.push(entry);
  };
  for (const market of markets) {
    for (const [state, aliases] of Object.entries(market.aliases)) {
      for (const alias of aliases) {
        add(alias, { market: market.slug, state });
        const words = basicNorm(alias).split(" ");
        if (
          words.length > 1 &&
          words[words.length - 1].toUpperCase() === state
        ) {
          add(words.slice(0, -1).join(" "), { market: market.slug, state });
        }
      }
    }
  }
  return index;
})();

const citySlugIndex: Map<string, string> = (() => {
  const index = new Map<string, string>();
  for (const market of markets) {
    for (const slug of market.citySlugs)
      index.set(slug.toLowerCase(), market.slug);
  }
  return index;
})();

/** Alias texts claimed by more than one market. Exported so the test can pin the set. */
export function ambiguousAliases(): string[] {
  const out: string[] = [];
  for (const [alias, entries] of aliasIndex) {
    if (new Set(entries.map((e) => e.market)).size > 1) out.push(alias);
  }
  return out.sort();
}

/** The market a src/data/cities slug or an events.ts citySlug belongs to. */
export function marketForCitySlug(
  slug: string | null | undefined,
): string | null {
  if (!slug) return null;
  return citySlugIndex.get(basicNorm(slug).replace(/ /g, "-")) ?? null;
}

type TextMatch = { market: string } | { ambiguous: true } | null;

function matchPlaceText(raw: string | null | undefined): TextMatch {
  const { name, state } = parsePlace(raw);
  if (!name) return null;
  const entries = aliasIndex.get(name);
  if (entries) {
    const candidates = state
      ? entries.filter((e) => e.state === state)
      : entries;
    const distinct = [...new Set(candidates.map((e) => e.market))];
    if (distinct.length === 1) return { market: distinct[0] };
    if (distinct.length > 1) return { ambiguous: true };
    // The name is known but not in the stated state: a Portland, Maine rather
    // than a Portland, Oregon. Fall through to the state rollup, which refuses
    // the states that hold more than one market.
  }
  if (state && stateRollup[state]) return { market: stateRollup[state] };
  return null;
}

/**
 * True when a lead's `city` is the IP-geo value rather than something the
 * person typed.
 *
 * WHY this exists: HomeSignup.astro prefills the optional city input from
 * `gmd-geo-city` in sessionStorage, so the spice-list forms submit geo data in
 * the self-reported field. Measured on the 2026-10-02 export of 891 leads, 140
 * of the 515 city-bearing rows are exact echoes of geoCity, including 32
 * `Des%20Moines` (Google Cloud) and 7 `Boydton` (Azure) that no human typed.
 * Trusting `city` blindly would file those as high confidence and mail them.
 *
 * The URL-encoded test is decisive on its own: a person typing into a text
 * input never produces `%20`. The equality test is deliberately broader than
 * the datacenter rows, because a residential geo hit and a datacenter geo hit
 * are indistinguishable here, and a genuine Chicagoan who left the prefill
 * alone losing the automatic send is recoverable while mailing a Google
 * datacenter is not. Comparison is against geoCity in its submitted form, not
 * the parsed one, so "Los Angeles, CA" stays self-reported: the prefill never
 * writes a state suffix.
 */
export function isGeoEcho(
  city: string | null | undefined,
  geoCity: string | null | undefined,
): boolean {
  if (!city) return false;
  if (/%[0-9a-f]{2}/i.test(city)) return true;
  const typed = basicNorm(city);
  const geo = basicNorm(geoCity);
  return Boolean(geo) && typed === geo;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Nearest market whose own radius contains the point, or null. */
export function nearestMarket(lat: number, lon: number): Market | null {
  let best: Market | null = null;
  let bestKm = Infinity;
  for (const market of markets) {
    const km = haversineKm(lat, lon, market.lat, market.lon);
    if (km <= market.radiusKm && km < bestKm) {
      best = market;
      bestKm = km;
    }
  }
  return best;
}

/**
 * Buckets one lead into a sending market.
 *
 * Precedence, and why it is this order:
 *  1. A typed city that is not a geo echo. Typing over a prefilled input is a
 *     deliberate statement of where someone lives.
 *  2. sourceCitySlug. The city page or notify modal they used. Reliable, but it
 *     is where they were browsing, so a typed city outranks it.
 *  3. A geo-echo city, then raw coordinates. Both are IP data, both grade `low`,
 *     and `low` is excluded from automatic sends by design.
 *
 * `medium` is the state rollup: the city text was not a known alias but its
 * state holds exactly one market. stateRollup leaves out NY, NJ, CA, TX, FL, PA
 * and VA for that reason.
 */
export function resolveMarket(input: MarketInput): MarketResolution {
  const unresolved = (reason: string): MarketResolution => ({
    market: null,
    confidence: null,
    source: null,
    reason,
  });

  const city = input.city ?? null;
  const echo = isGeoEcho(city, input.geoCity);

  if (city && !echo) {
    const match = matchPlaceText(city);
    if (match && "market" in match) {
      const parsed = parsePlace(city);
      const exact = aliasIndex.has(parsed.name);
      return {
        market: match.market,
        confidence: exact ? "high" : "medium",
        source: "self-reported",
      };
    }
    if (match && "ambiguous" in match) {
      const slug = marketForCitySlug(input.sourceCitySlug);
      if (slug)
        return { market: slug, confidence: "high", source: "source-city" };
      return unresolved(
        `ambiguous city name "${parsePlace(city).name}", needs a state`,
      );
    }
  }

  const fromSourceCity = marketForCitySlug(input.sourceCitySlug);
  if (fromSourceCity) {
    return {
      market: fromSourceCity,
      confidence: "high",
      source: "source-city",
    };
  }

  if (city && echo) {
    const match = matchPlaceText(city);
    if (match && "market" in match) {
      return { market: match.market, confidence: "low", source: "geo" };
    }
  }

  const lat = toNumber(input.geoLatitude);
  const lon = toNumber(input.geoLongitude);
  if (lat !== null && lon !== null) {
    const near = nearestMarket(lat, lon);
    if (near) return { market: near.slug, confidence: "low", source: "geo" };
    return unresolved("coordinates fall outside every market radius");
  }

  if (city)
    return unresolved(`city "${parsePlace(city).name}" is not in any market`);
  return unresolved("no city, source city or coordinates on this record");
}
