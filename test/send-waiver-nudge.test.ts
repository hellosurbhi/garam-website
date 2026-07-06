import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAdminIdentity: vi.fn(),
  fsGet: vi.fn(),
  fsPatch: vi.fn(),
  fsAdd: vi.fn(),
  fsQuery: vi.fn(),
  sendMail: vi.fn(),
  waiverNudge: vi.fn(() => ({ subject: "s", text: "t", html: "<p>h</p>" })),
}));

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminIdentity: mocks.verifyAdminIdentity,
}));
vi.mock("@/lib/firestoreRest", () => ({
  fsGet: mocks.fsGet,
  fsPatch: mocks.fsPatch,
  fsAdd: mocks.fsAdd,
  fsQuery: mocks.fsQuery,
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/data/emails", () => ({ waiverNudge: mocks.waiverNudge }));
vi.mock("@/data/events", () => ({
  events: [
    {
      city: "New York",
      citySlug: "nyc",
      isoDate: "2099-12-31",
      date: "Dec 31 2099",
      hidden: false,
    },
  ],
}));

const { POST } = await import("@/pages/api/actions/send-waiver-nudge");

function makeRequest(body: unknown): Request {
  return new Request(
    "https://garammasaladating.com/api/actions/send-waiver-nudge",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer admin-token",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("send-waiver-nudge POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAdminIdentity.mockResolvedValue({
      uid: "admin-1",
      email: "admin@garammasaladating.com",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mocks.verifyAdminIdentity.mockResolvedValue(null);
    const req = makeRequest({ applicationId: "app-123" });
    const res = await POST({ request: req } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 400 when applicationId contains a slash", async () => {
    const req = makeRequest({ applicationId: "app/traversal" });
    const res = await POST({ request: req } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    expect(mocks.fsGet).not.toHaveBeenCalled();
  });

  it("returns 400 when applicationId is empty", async () => {
    const req = makeRequest({ applicationId: "" });
    const res = await POST({ request: req } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("returns 404 when application does not exist", async () => {
    mocks.fsGet.mockResolvedValue(null);
    const req = makeRequest({ applicationId: "app-123" });
    const res = await POST({ request: req } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(404);
    expect(mocks.fsGet).toHaveBeenCalledWith("applications/app-123");
  });
});
