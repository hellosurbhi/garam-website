import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockGetFirestoreAccessToken, mockAddKitSubscriber } = vi.hoisted(
  () => ({
    mockGetFirestoreAccessToken: vi.fn(),
    mockAddKitSubscriber: vi.fn(),
  }),
);

vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: mockGetFirestoreAccessToken,
}));

vi.mock("@/lib/kit", () => ({
  addKitSubscriber: mockAddKitSubscriber,
}));

const { POST } = await import("@/pages/api/sync-leads-to-kit");

function makeRequest(auth = "Bearer test-cron-secret"): Request {
  return new Request("https://garammasaladating.com/api/sync-leads-to-kit", {
    method: "POST",
    headers: { Authorization: auth },
  });
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

describe("sync-leads-to-kit handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    import.meta.env.CRON_SECRET = "test-cron-secret";
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    mockGetFirestoreAccessToken.mockResolvedValue("firestore-token");
    mockAddKitSubscriber.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.CRON_SECRET;
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  });

  it("lists Firestore leads with service-account auth and syncs them to Kit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          documents: [
            {
              name: "projects/test/databases/(default)/documents/leads/lead1",
              fields: {
                email: { stringValue: "person@example.com" },
                city: { stringValue: "San Francisco" },
                sourcePage: { stringValue: "/cities/san-francisco" },
                landingPage: { stringValue: "/" },
                utmSource: { stringValue: "instagram" },
                utmMedium: { stringValue: "social" },
                utmCampaign: { stringValue: "spring" },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await POST(makeContext(makeRequest()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, synced: 1, errors: 0 });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://firestore.googleapis.com/v1/projects/test-project/databases/(default)/documents/leads?pageSize=300",
      expect.objectContaining({
        headers: { Authorization: "Bearer firestore-token" },
      }),
    );
    expect(mockAddKitSubscriber).toHaveBeenCalledWith(
      "person@example.com",
      ["website-lead", "backfill", "san-francisco", "instagram"],
      {
        city: "San Francisco",
        source_page: "/cities/san-francisco",
        landing_page: "/",
        utm_source: "instagram",
        utm_medium: "social",
        utm_campaign: "spring",
      },
    );
  });

  it("rejects requests without the cron secret", async () => {
    const res = await POST(makeContext(makeRequest("Bearer wrong-secret")));

    expect(res.status).toBe(401);
    expect(mockGetFirestoreAccessToken).not.toHaveBeenCalled();
  });

  it("returns 500 when service-account auth fails", async () => {
    mockGetFirestoreAccessToken.mockRejectedValue(new Error("missing key"));

    const res = await POST(makeContext(makeRequest()));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "Firestore auth failed",
      detail: "missing key",
    });
  });
});
