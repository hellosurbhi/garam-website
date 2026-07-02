import { describe, it, expect, beforeEach, vi } from "vitest";

const addInvite = vi.fn().mockResolvedValue({ id: "invite-1" });
const verifyAdminToken = vi.fn().mockResolvedValue("admin-1");

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken,
}));

vi.mock("@/lib/firebaseAdmin", () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      add: addInvite,
    })),
  })),
}));

vi.mock("@/data/events", () => ({
  events: [
    {
      citySlug: "manhattan",
      city: "Manhattan",
      date: "June 1, 2026",
      isoDate: "2026-06-01",
      startTime: "18:00",
      venue: {
        name: "Top Secret Comedy Club",
        streetAddress: "44 Avenue A",
      },
      timezone: "America/New_York",
      hidden: false,
    },
  ],
}));

const { POST } = await import("@/pages/api/create-invite");

function makeContext(body: Record<string, unknown>) {
  return {
    request: new Request("https://garammasaladating.com/api/create-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof POST>[0];
}

describe("create-invite handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminToken.mockResolvedValue("admin-1");
    import.meta.env.SITE = "https://garammasaladating.com";
    delete import.meta.env.RESEND_API_KEY;
  });

  it("requires an allowlisted admin token", async () => {
    verifyAdminToken.mockResolvedValue(null);

    const response = await POST(
      makeContext({
        showId: "manhattan-2026-06-01",
        role: "female",
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(addInvite).not.toHaveBeenCalled();
  });

  it("creates invites with canonical lowercase role values", async () => {
    const response = await POST(
      makeContext({
        applicantId: "app-1",
        applicantName: "Priya Shah",
        applicantEmail: "priya@example.com",
        showId: "manhattan-2026-06-01",
        role: "female",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      inviteId: "invite-1",
      inviteUrl:
        "https://garammasaladating.com/contestant-portal?invite=invite-1",
      emailSent: false,
      emailError: "Email service is not configured.",
    });
    expect(addInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantId: "app-1",
        applicantEmail: "priya@example.com",
        role: "female",
        showId: "manhattan-2026-06-01",
        showDisplayDate: "June 1, 2026",
        showStartTime: "18:00",
        showVenueName: "Top Secret Comedy Club",
        showVenueAddress: "44 Avenue A",
        showTimezone: "America/New_York",
      }),
    );
  });

  it("rejects display-label role values instead of storing unusable invites", async () => {
    const response = await POST(
      makeContext({
        showId: "manhattan-2026-06-01",
        role: "Female Contestant",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid role. Must be one of: female, male",
    });
    expect(addInvite).not.toHaveBeenCalled();
  });
});
