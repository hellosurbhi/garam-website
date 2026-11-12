import { expect, it, vi } from "vitest";
import type { EventEntry } from "@/data/events";

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken: vi.fn(async () => "admin"),
}));
vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn(async () => "fixture"),
}));

// A show that exists only in the live published list, never in the build's
// baked snapshot: the route labels its revenue only if it reads the live list.
const liveShow = {
  date: "Dec 31",
  city: "Live Published City",
  state: "New York",
  stateAbbr: "NY",
  citySlug: "live-published-city",
  slug: "live-published-city-2099-12-31",
  description: "Fixture",
  lineup: [],
  ticketSource: "our-eventbrite",
  url: "https://www.eventbrite.com/e/live-999",
  isoDate: "2099-12-31",
  eventbriteId: "999",
} satisfies EventEntry;

vi.mock("@/lib/publishedEvents.server", () => ({
  getLiveEvents: vi.fn(async () => ({
    events: [liveShow],
    allEvents: [liveShow],
  })),
}));

const { GET } = await import("@/pages/api/analytics");

it("labels revenue with show details from the live published list", async () => {
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("syncMeta")) return new Response(null, { status: 404 });
      const documents = url.includes("/orders?")
        ? [
            {
              name: "projects/test/databases/(default)/documents/orders/o1",
              fields: {
                orderId: { stringValue: "o1" },
                eventbriteEventId: { stringValue: "999" },
                eventSlug: { stringValue: "live-published-city" },
                email: { stringValue: "buyer@example.com" },
                quantity: { integerValue: "2" },
                grossRevenue: { doubleValue: 40 },
                netRevenue: { doubleValue: 36 },
                status: { stringValue: "placed" },
                createdAt: { stringValue: "2026-11-11T00:00:00Z" },
              },
            },
          ]
        : [];
      return new Response(JSON.stringify({ documents }));
    });
  import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = "test";
  try {
    const url = new URL(
      "https://garammasaladating.com/api/analytics?period=all",
    );
    const response = await GET({ url, request: new Request(url) } as Parameters<
      typeof GET
    >[0]);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.revenueByShow).toEqual([
      expect.objectContaining({
        eventbriteEventId: "999",
        city: "Live Published City",
        eventDate: "Dec 31",
      }),
    ]);
    expect(body.revenueByCity).toEqual([
      expect.objectContaining({
        citySlug: "live-published-city",
        city: "Live Published City",
      }),
    ]);
  } finally {
    network.mockRestore();
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  }
});
