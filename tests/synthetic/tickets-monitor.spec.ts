import { test, expect } from "@playwright/test";
import { allEvents } from "../../src/data/events";
import { isEventDatePast } from "../../src/utils/eventDate";
import { applyUtmsToUrl } from "../../src/utils/utmForwarding";
import { requireVersion } from "../../scripts/synthetic/deployment.mjs";

test("live ticket redirects use their configured checkout destinations", async ({
  request,
}) => {
  await requireVersion(process.env.GITHUB_SHA);
  const events = allEvents.filter(
    (event) =>
      event.url &&
      event.url !== "#" &&
      event.status !== "canceled" &&
      !isEventDatePast(event),
  );
  expect(events.length).toBeGreaterThan(0);
  for (const event of events) {
    const response = await request.get(`/api/go/${event.slug}`, {
      maxRedirects: 0,
      timeout: 10_000,
      headers: {
        "User-Agent": "GaramMasalaMonitor/1.0",
      },
    });
    expect(response.status(), event.slug).toBe(302);
    expect(response.headers().location, event.slug).toBe(
      applyUtmsToUrl(
        event.url,
        {},
        {
          utmSource: "garamsite",
          utmMedium: "web",
          utmCampaign: event.citySlug ?? "event",
          utmContent: event.slug,
        },
      ),
    );
  }
});
