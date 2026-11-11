/**
 * One-time migration oracle for issue 337 (temporary, deleted once its
 * outputs are committed; git keeps it).
 *
 * Reads the hand-written src/data/events.ts as it exists BEFORE the
 * JSON-sourcing refactor and writes:
 *  - src/data/events.published.json: the version 1 envelope the refactored
 *    events.ts will load. Byte-faithful to today's records (no "#"
 *    normalization, plan R12); each entry gains only `updatedAt`, taken from
 *    the git date of events.ts.
 *  - test/fixtures/events-pre-migration.json: the old code's `events`,
 *    `TBA_CITIES` and `allEvents` for a fixed todayIso, so the refactor's
 *    oracle test compares against output produced by the OLD code, never
 *    against itself (plan R17).
 *
 * Run (no tsx in this repo; src/data uses extensionless relative imports
 * that plain Node cannot resolve, so Vite's module runner loads it, the same
 * loader astro.config.mjs uses):
 *   node -e "import('vite').then((v) => v.runnerImport('./scripts/export-events-baseline.ts'))"
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { comingSoonEvents, computeAllEvents, events } from "../src/data/events";

// WHY a fixed date: Manhattan's last dated show is Nov 13 while LA and SF
// have December shows, so this day exercises both branches of TBA
// suppression (Manhattan TBA card shown, LA and SF suppressed).
const FIXTURE_TODAY_ISO = "2026-11-14";

const gitDate = execSync("git log -1 --format=%cI -- src/data/events.ts", {
  encoding: "utf8",
}).trim();
if (!gitDate) throw new Error("No git date for src/data/events.ts");
const updatedAt = new Date(gitDate).toISOString();

// TBA_CITIES is module-private in the old events.ts; comingSoonEvents is
// built 1:1 from it, so its city fields are the original records.
const tbaCities = comingSoonEvents.map((e) => {
  if (!e.citySlug) throw new Error(`TBA entry ${e.slug} has no citySlug`);
  return {
    city: e.city,
    state: e.state,
    stateAbbr: e.stateAbbr,
    citySlug: e.citySlug,
  };
});

const envelope = {
  version: 1,
  publishedAt: updatedAt,
  snapshot: {
    events: events.map((e) => ({ ...e, updatedAt })),
    tbaCities,
  },
};

const fixture = {
  todayIso: FIXTURE_TODAY_ISO,
  events,
  TBA_CITIES: tbaCities,
  allEvents: computeAllEvents(events, comingSoonEvents, FIXTURE_TODAY_ISO),
};

writeFileSync(
  "src/data/events.published.json",
  `${JSON.stringify(envelope, null, 2)}\n`,
);
writeFileSync(
  "test/fixtures/events-pre-migration.json",
  `${JSON.stringify(fixture, null, 2)}\n`,
);
process.stdout.write(
  `Exported ${events.length} events, ${tbaCities.length} TBA cities, ${fixture.allEvents.length} allEvents\n`,
);
