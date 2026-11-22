import { test } from "@playwright/test";
import { allEvents } from "../../src/data/events";
import { requireVersion } from "../../scripts/synthetic/deployment.mjs";
import { checkTicketListings, TICKET_CHECK_BUDGET_MS } from "./ticket-checks";

// WHY no retry, when the config retries once: a second 5 minute attempt
// after a slow first one could outlast the 15 minute job, and a cancelled
// job hides the verdict instead of paging.
test.describe.configure({ retries: 0 });

test("live ticket redirects use their configured checkout destinations", async ({
  page,
  request,
}) => {
  // WHY this budget: see TICKET_CHECK_BUDGET_MS. With no retry it also stays
  // inside the 15 minute job alongside signup.
  test.setTimeout(TICKET_CHECK_BUDGET_MS);
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
