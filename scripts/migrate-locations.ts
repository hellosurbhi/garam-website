/**
 * One-time migration: backfill legacy freetext city records with structured
 * country/state/city fields.
 *
 * Usage:
 *   npm run migrate:locations            # dry-run (default)
 *   npm run migrate:locations -- --execute   # actually write to Firestore
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { City } from "country-state-city";

// ---------------------------------------------------------------------------
// 1. Load env vars from .env.local (no dotenv dependency needed)
// ---------------------------------------------------------------------------
function loadEnv(): Record<string, string> {
  const envPath = resolve(import.meta.dirname, "..", ".env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// 2. Build reverse lookup: lowercase city name → { countryCode, stateCode, name }
// ---------------------------------------------------------------------------
interface CityMatch {
  countryCode: string;
  stateCode: string;
  name: string;
}

/** Common aliases mapping to canonical city names used by country-state-city */
const ALIASES: Record<string, string> = {
  nyc: "New York City",
  "new york": "New York City",
  sf: "San Francisco",
  la: "Los Angeles",
  philly: "Philadelphia",
  dc: "Washington",
  "washington dc": "Washington",
  "washington d.c.": "Washington",
  chi: "Chicago",
  "sd": "San Diego",
  atl: "Atlanta",
  hou: "Houston",
  dal: "Dallas",
  "ft worth": "Fort Worth",
  "ft. worth": "Fort Worth",
  "st louis": "St. Louis",
  "st. louis": "St. Louis",
};

/** For US cities that exist in multiple states, pick the well-known one. */
const US_STATE_PREFERENCE: Record<string, string> = {
  "san diego": "CA",
  "portland": "OR",
  "springfield": "IL",
  "columbus": "OH",
  "richmond": "VA",
  "jackson": "MS",
  "arlington": "TX",
  "burlington": "VT",
};

function buildCityIndex(): Map<string, CityMatch[]> {
  const index = new Map<string, CityMatch[]>();

  // Index all cities worldwide but prioritize US
  const allCities = City.getAllCities();
  for (const c of allCities) {
    const key = c.name.toLowerCase();
    const entry: CityMatch = {
      countryCode: c.countryCode,
      stateCode: c.stateCode,
      name: c.name,
    };
    const existing = index.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      index.set(key, [entry]);
    }
  }

  return index;
}

function resolveCity(
  rawCity: string,
  index: Map<string, CityMatch[]>,
): CityMatch | null {
  const normalized = rawCity.trim().toLowerCase();
  if (!normalized) return null;

  // Check alias map first
  const aliasTarget = ALIASES[normalized];
  const lookupKey = aliasTarget ? aliasTarget.toLowerCase() : normalized;

  const matches = index.get(lookupKey);
  if (!matches || matches.length === 0) return null;

  // Prefer US matches
  const usMatches = matches.filter((m) => m.countryCode === "US");

  // If exactly one US match, use it
  if (usMatches.length === 1) return usMatches[0];

  // If multiple US matches, check disambiguation map
  if (usMatches.length > 1) {
    const preferred = US_STATE_PREFERENCE[lookupKey];
    if (preferred) {
      const pick = usMatches.find((m) => m.stateCode === preferred);
      if (pick) return pick;
    }
    return null;
  }

  // If no US match but exactly one worldwide match, use it
  if (matches.length === 1) return matches[0];

  // Multiple non-US matches — ambiguous
  return null;
}

// ---------------------------------------------------------------------------
// 3. Run migration
// ---------------------------------------------------------------------------
async function migrate() {
  const execute = process.argv.includes("--execute");
  console.log(execute ? "🔥 EXECUTE mode — writing to Firestore" : "👀 DRY RUN — no writes");
  console.log();

  const cityIndex = buildCityIndex();
  console.log(`City index built: ${cityIndex.size} unique city names`);

  const snap = await getDocs(collection(db, "applications"));
  console.log(`Total applications: ${snap.size}`);

  interface LegacyDoc {
    id: string;
    city: string;
  }

  const legacy: LegacyDoc[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (!data.country) {
      legacy.push({ id: d.id, city: data.city ?? "" });
    }
  }

  console.log(`Legacy records (no country): ${legacy.length}`);
  console.log();

  const migrated: { id: string; from: string; to: CityMatch }[] = [];
  const skipped: { id: string; city: string }[] = [];

  for (const record of legacy) {
    const match = resolveCity(record.city, cityIndex);
    if (match) {
      migrated.push({ id: record.id, from: record.city, to: match });
      if (execute) {
        await updateDoc(doc(db, "applications", record.id), {
          country: match.countryCode,
          state: match.stateCode,
          city: match.name,
        });
      }
    } else {
      skipped.push({ id: record.id, city: record.city });
    }
  }

  console.log("--- MIGRATED ---");
  if (migrated.length === 0) {
    console.log("  (none)");
  } else {
    for (const m of migrated) {
      console.log(`  ${m.id}: "${m.from}" → ${m.to.name}, ${m.to.stateCode}, ${m.to.countryCode}`);
    }
  }

  console.log();
  console.log("--- SKIPPED (ambiguous or no match) ---");
  if (skipped.length === 0) {
    console.log("  (none)");
  } else {
    for (const s of skipped) {
      console.log(`  ${s.id}: "${s.city}"`);
    }
  }

  console.log();
  console.log(`Summary: ${migrated.length} migrated, ${skipped.length} skipped, ${legacy.length} total legacy`);

  if (!execute && migrated.length > 0) {
    console.log("\nRe-run with --execute to apply changes.");
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
