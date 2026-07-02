import { describe, it, expect, beforeEach, vi } from "vitest";

const txSet = vi.fn();
const txUpdate = vi.fn();
const contestantSet = vi.fn();
const signPortalToken = vi.fn().mockResolvedValue("signed-portal-token");

const inviteRecord = {
  role: "female",
  showId: "manhattan-2026-06-01",
  showCity: "Manhattan",
  showDate: "2026-06-01",
  showTimezone: "America/New_York",
  claimed: false,
};

const inviteSnapshot = {
  exists: true,
  data: () => inviteRecord,
};

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  contestantClaimLimiter: {},
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/portalToken", () => ({
  signPortalToken,
  _midnightLocalUnix: vi.fn(() => 1_783_036_800),
}));

vi.mock("@/lib/firebaseAdmin", () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn((name: string) => {
      if (name === "invites") {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue(inviteSnapshot),
          })),
        };
      }
      if (name === "contestants") {
        return {
          doc: vi.fn(() => ({
            id: "contestant-1",
            set: contestantSet,
          })),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) =>
      callback({
        get: vi.fn().mockResolvedValue(inviteSnapshot),
        set: txSet,
        update: txUpdate,
      }),
    ),
  })),
}));

vi.mock("@/data/waiver", () => ({
  WAIVER_VERSION: "2026-04-01",
  WAIVER_TEXT: "Test waiver text",
}));

vi.mock("@/data/events", () => ({
  events: [
    {
      citySlug: "manhattan",
      city: "Manhattan",
      date: "June 1, 2026",
      isoDate: "2026-06-01",
      timezone: "America/New_York",
      hidden: false,
    },
    {
      citySlug: "secret-city",
      city: "Secret City",
      date: "June 2, 2026",
      isoDate: "2026-06-02",
      timezone: "America/New_York",
      hidden: true,
    },
  ],
}));

const { POST: claimInvite } = await import("@/pages/api/contestant-claim");
const { POST: claimShow } = await import("@/pages/api/contestant-show-claim");
const { POST: claimOpen } = await import("@/pages/api/contestant-open-claim");

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Priya",
    lastName: "Shah",
    email: "priya@example.com",
    phone: "5551234567",
    waiverAgreed: true,
    signature: "Priya Shah",
    waiverVersion: "2026-04-01",
    mailingListOptIn: true,
    ...overrides,
  };
}

function makeContext(path: string, body: Record<string, unknown>) {
  return {
    request: new Request(`https://garammasaladating.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

describe("contestant claim handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete import.meta.env.RESEND_API_KEY;
  });

  it("sets a portal session cookie visible to /api/portal-state after invite claim", async () => {
    const response = await claimInvite(
      makeContext(
        "/api/contestant-claim",
        makeBody({ inviteId: "invite-1" }),
      ) as Parameters<typeof claimInvite>[0],
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "portal_session=signed-portal-token; Path=/;",
    );
    expect(response.headers.get("set-cookie")).not.toContain(
      "Path=/contestant-portal",
    );
    expect(txSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ postShowEmailSentAt: null }),
    );
  });

  it("sets a portal session cookie visible to /api/portal-state after per-show claim", async () => {
    const response = await claimShow(
      makeContext(
        "/api/contestant-show-claim",
        makeBody({
          showId: "manhattan-2026-06-01",
          role: "female",
        }),
      ) as Parameters<typeof claimShow>[0],
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "portal_session=signed-portal-token; Path=/;",
    );
    expect(response.headers.get("set-cookie")).not.toContain(
      "Path=/contestant-portal",
    );
    expect(contestantSet).toHaveBeenCalledWith(
      expect.objectContaining({ postShowEmailSentAt: null }),
    );
  });

  it("sets a portal session cookie after direct contestant packet claim", async () => {
    const response = await claimOpen(
      makeContext(
        "/api/contestant-open-claim",
        makeBody({ role: "female" }),
      ) as Parameters<typeof claimOpen>[0],
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "portal_session=signed-portal-token; Path=/;",
    );
    expect(contestantSet).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "female",
        showId: "open-casting-packet",
        showDate: "Casting date to be confirmed",
        postShowEmailSentAt: null,
      }),
    );
  });

  it("rejects hidden events in per-show claim links", async () => {
    const response = await claimShow(
      makeContext(
        "/api/contestant-show-claim",
        makeBody({
          showId: "secret-city-2026-06-02",
          role: "female",
        }),
      ) as Parameters<typeof claimShow>[0],
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invalid show" });
    expect(contestantSet).not.toHaveBeenCalled();
  });

  it("does not create contestant prep access for spectator waiver claims", async () => {
    const response = await claimShow(
      makeContext(
        "/api/contestant-show-claim",
        makeBody({
          showId: "manhattan-2026-06-01",
          role: "spectator",
        }),
      ) as Parameters<typeof claimShow>[0],
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Spectators only need the standalone waiver at /waiver.",
    });
    expect(contestantSet).not.toHaveBeenCalled();
  });
});
