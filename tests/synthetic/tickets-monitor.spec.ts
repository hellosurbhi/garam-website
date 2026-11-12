import { test } from "@playwright/test";
import { buildAllEvents } from "../../src/data/events";
import { parseEventsSnapshot } from "../../src/data/eventsSnapshot";
import { requireVersion } from "../../scripts/synthetic/deployment.mjs";
import { requireEventsVersion } from "../../scripts/synthetic/events-version.mjs";
import { checkTicketListings } from "./ticket-checks";

test("live ticket redirects use their configured checkout destinations", async ({
  page,
  request,
}) => {
  // WHY 25 minutes: requireEventsVersion may wait out a 20 minute rebuild
  // grace in this run rather than skip it (a skip would read as a pass).
  test.setTimeout(25 * 60_000);
  await requireVersion(process.env.GITHUB_SHA);
  // WHY not the repo's events.published.json: the Shows tab publishes
  // without a commit, so the deployment was built from Firestore's list,
  // not the file at GITHUB_SHA (plan R10).
  const published = await requireEventsVersion();
  const allEvents = buildAllEvents(
    parseEventsSnapshot(published),
    new Date().toISOString().slice(0, 10),
  );
  // Identify synthetic HTTP requests and block marketing collection before navigation.
  await page.setExtraHTTPHeaders({ "User-Agent": "GaramMasalaMonitor/1.0" });
  await page.route(
    /https:\/\/[^/]*(posthog\.com|google-analytics\.com|googletagmanager\.com|facebook\.com|facebook\.net|vercel-insights\.com)\//,
    (route) => route.abort(),
  );
  await page.route("**/ingest/**", (route) => route.abort());
  await page.route("**/_vercel/insights/**", (route) => route.abort());
  await page.goto("/tickets");
  await checkTicketListings(page, request, allEvents);
});
