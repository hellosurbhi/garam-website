import { test } from "@playwright/test";
import { allEvents } from "../../src/data/events";
import { requireVersion } from "../../scripts/synthetic/deployment.mjs";
import { checkTicketListings } from "./ticket-checks";

test("live ticket redirects use their configured checkout destinations", async ({
  page,
  request,
}) => {
  await requireVersion(process.env.GITHUB_SHA);
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
