import { test } from "@playwright/test";
import { allEvents } from "../../src/data/events";
import { requireVersion } from "../../scripts/synthetic/deployment.mjs";
import { checkTicketListings } from "./ticket-checks";

test("live ticket redirects use their configured checkout destinations", async ({
  page,
  request,
}) => {
  // WHY 8 minutes, not the config's 2: each on-sale show can spend 10
  // seconds on its redirect and 15 on a vendor that never answers, so a
  // slow vendor day would cut the run short and page as a wrong link. 8
  // minutes covers about 15 such shows and stays inside the 15 minute job.
  test.setTimeout(8 * 60_000);
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
  // WHY verify listings here too, not only in the weekly smoke run: a deploy
  // is exactly when a wrong checkout URL ships, and a week is too late to
  // learn a show links to someone else's event. Vendors served these pages
  // to GitHub runners on all five smoke projects (run 43155247049).
  // "whenServed" so a vendor blocking or rate limiting the runner is noted
  // instead of paging as a wrong link; the weekly smoke run still fails on it.
  await checkTicketListings(page, request, allEvents, new Date(), {
    verifyListings: "whenServed",
  });
});
