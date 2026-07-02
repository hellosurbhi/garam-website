import { describe, it, expect, beforeEach, vi } from "vitest";

const verifyAdminToken = vi.fn().mockResolvedValue("admin-1");
const getInvites = vi.fn();

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken,
}));

vi.mock("@/lib/firebaseAdmin", () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        get: getInvites,
      })),
    })),
  })),
}));

const { GET } = await import("@/pages/api/contestants");

function makeContext(auth = "Bearer admin-token") {
  return {
    request: new Request("https://garammasaladating.com/api/contestants", {
      headers: { Authorization: auth },
    }),
  } as Parameters<typeof GET>[0];
}

describe("contestants API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminToken.mockResolvedValue("admin-1");
    getInvites.mockResolvedValue({
      docs: [
        {
          id: "invite-1",
          data: () => ({
            applicantId: "app-1",
            applicantName: "Priya Shah",
            applicantEmail: "priya@example.com",
            showId: "manhattan-2026-06-01",
            showDate: "2026-06-01",
            role: "female",
            claimed: false,
            createdAt: "2026-05-15T12:00:00.000Z",
          }),
        },
      ],
    });
  });

  it("requires an allowlisted admin token", async () => {
    verifyAdminToken.mockResolvedValue(null);

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(getInvites).not.toHaveBeenCalled();
  });

  it("returns contestant invites from the server credential", async () => {
    const response = await GET(makeContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      invites: [
        {
          id: "invite-1",
          applicantId: "app-1",
          applicantName: "Priya Shah",
          applicantEmail: "priya@example.com",
          showId: "manhattan-2026-06-01",
          showDate: "2026-06-01",
          role: "female",
          claimed: false,
          createdAt: "2026-05-15T12:00:00.000Z",
        },
      ],
    });
  });
});
