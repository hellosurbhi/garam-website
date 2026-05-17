import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const fsGet = vi.fn();
  const verifyPortalToken = vi.fn();

  return { fsGet, verifyPortalToken };
});

vi.mock("@/lib/firestoreRest", () => ({ fsGet: mocks.fsGet }));
vi.mock("@/lib/portalToken", () => ({
  verifyPortalToken: mocks.verifyPortalToken,
}));

const { GET } = await import("@/pages/api/portal-state");

function makeRequest(path = "/api/portal-state"): Request {
  return new Request(`https://garammasaladating.com${path}`);
}

function makeRequestWithCookie(cookie: string): Request {
  return new Request("https://garammasaladating.com/api/portal-state", {
    headers: { cookie },
  });
}

describe("portal-state GET /api/portal-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("show param (blocked)", () => {
    it("returns 400 error for a ?show= param (contestant packet links are private)", async () => {
      const req = makeRequest("/api/portal-state?show=nyc-2099-12-31");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.state).toBe("error");
      expect(body.message).toMatch(/private/i);
    });
  });

  describe("invite param", () => {
    it("rejects inviteId containing a slash with 400", async () => {
      const req = makeRequest("/api/portal-state?invite=foo/bar");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.state).toBe("error");
      expect(mocks.fsGet).not.toHaveBeenCalled();
    });

    it("returns invite state for a valid unclaimed invite", async () => {
      mocks.fsGet.mockResolvedValue({
        claimed: false,
        showCity: "New York",
        showDate: "2099-12-31",
        showDisplayDate: "December 31",
        showStartTime: "20:00",
        showVenueName: "Test Venue",
        role: "female",
      });
      const req = makeRequest("/api/portal-state?invite=invite-123");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      expect(mocks.fsGet).toHaveBeenCalledWith("invites/invite-123");
      const body = await res.json();
      expect(body.state).toBe("invite");
      expect(body.inviteId).toBe("invite-123");
      expect(body.role).toBe("female");
    });

    it("returns 404 when invite does not exist", async () => {
      mocks.fsGet.mockResolvedValue(null);
      const req = makeRequest("/api/portal-state?invite=bad-id");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.state).toBe("error");
    });

    it("returns error when invite is already claimed", async () => {
      mocks.fsGet.mockResolvedValue({ claimed: true });
      const req = makeRequest("/api/portal-state?invite=used-invite");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      const body = await res.json();
      expect(body.state).toBe("error");
      expect(body.message).toMatch(/already been used/i);
    });

    it("normalises legacy stealer role to spectator", async () => {
      mocks.fsGet.mockResolvedValue({
        claimed: false,
        role: "stealer",
        showCity: "",
        showDate: "2099-12-31",
      });
      const req = makeRequest("/api/portal-state?invite=inv");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      const body = await res.json();
      expect(body.role).toBe("spectator");
    });
  });

  describe("cookie / portal session", () => {
    it("returns no-access when no cookie is present", async () => {
      const req = makeRequest();
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      const body = await res.json();
      expect(body.state).toBe("no-access");
    });

    it("returns active state for valid session with waiver", async () => {
      mocks.verifyPortalToken.mockResolvedValue({ contestantId: "c-1" });
      mocks.fsGet.mockResolvedValue({
        firstName: "Jane",
        lastName: "Doe",
        role: "female",
        showCity: "New York",
        showDate: "2099-12-31",
        showDisplayDate: "December 31",
        showStartTime: "20:00",
        showVenueName: "Venue",
        signedAtIso: "2099-01-01T00:00:00Z",
        waiverVersion: "v1",
        signature: "Jane Doe",
        waiverTextHash: "abc123",
      });
      const req = makeRequestWithCookie("portal_session=valid-token");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      const body = await res.json();
      expect(body.state).toBe("active");
      expect(body.firstName).toBe("Jane");
    });

    it("returns expired when contestant doc is missing", async () => {
      mocks.verifyPortalToken.mockResolvedValue({ contestantId: "c-gone" });
      mocks.fsGet.mockResolvedValue(null);
      const req = makeRequestWithCookie("portal_session=stale-token");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      const body = await res.json();
      expect(body.state).toBe("expired");
    });

    it("returns no-access when contestant has not signed waiver", async () => {
      mocks.verifyPortalToken.mockResolvedValue({ contestantId: "c-2" });
      mocks.fsGet.mockResolvedValue({
        firstName: "Bob",
        lastName: "Smith",
        role: "male",
      });
      const req = makeRequestWithCookie("portal_session=no-waiver-token");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      const body = await res.json();
      expect(body.state).toBe("no-access");
    });

    it("returns expired for an invalid JWT", async () => {
      const err = new Error("bad token");
      err.name = "JWTExpired";
      mocks.verifyPortalToken.mockRejectedValue(err);
      const req = makeRequestWithCookie("portal_session=expired-token");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      const body = await res.json();
      expect(body.state).toBe("expired");
    });

    it("returns 500 for unexpected verification errors", async () => {
      mocks.verifyPortalToken.mockRejectedValue(new Error("unknown error"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const req = makeRequestWithCookie("portal_session=bad-token");
      const res = await GET({ request: req } as Parameters<typeof GET>[0]);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.state).toBe("error");
      errorSpy.mockRestore();
    });
  });
});
