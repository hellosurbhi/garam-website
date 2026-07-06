import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAdminIdentity: vi.fn(),
  fsAdd: vi.fn(),
  fsPatch: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminIdentity: mocks.verifyAdminIdentity,
}));
vi.mock("@/lib/firestoreRest", () => ({
  fsAdd: mocks.fsAdd,
  fsPatch: mocks.fsPatch,
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/data/events", () => ({
  events: [
    {
      city: "New York",
      citySlug: "nyc",
      isoDate: "2099-12-31",
      date: "Dec 31",
      startTime: "20:00",
      timezone: "America/New_York",
      venue: { name: "Top Secret", streetAddress: "44 Ave A" },
      hidden: false,
    },
  ],
}));

const { POST } = await import("@/pages/api/create-invite");

function makeRequest(body: unknown): Request {
  return new Request("https://garammasaladating.com/api/create-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer admin-token",
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  applicantId: "app-123",
  applicantName: "Priya",
  applicantEmail: "priya@example.com",
  showId: "nyc-2099-12-31",
  role: "female",
};

describe("create-invite POST /api/create-invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAdminIdentity.mockResolvedValue({
      uid: "admin-1",
      email: "admin@garammasaladating.com",
    });
    mocks.fsAdd.mockResolvedValue("invite-abc");
    mocks.fsPatch.mockResolvedValue(undefined);
    mocks.sendMail.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated callers with 401", async () => {
    mocks.verifyAdminIdentity.mockResolvedValue(null);
    const res = await POST({
      request: makeRequest(validBody),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    expect(mocks.fsAdd).not.toHaveBeenCalled();
  });

  it("rejects an unknown showId with 400", async () => {
    const res = await POST({
      request: makeRequest({ ...validBody, showId: "nope-2099-01-01" }),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("emails the native Cast Portal link (not the JotForm waiver)", async () => {
    const res = await POST({
      request: makeRequest(validBody),
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    const body = await res.json();
    const expectedUrl =
      "https://garammasaladating.com/contestant-portal?invite=invite-abc";
    expect(body.inviteUrl).toBe(expectedUrl);
    expect(body.inviteUrl).not.toContain("/waiver");

    const mailArg = mocks.sendMail.mock.calls[0][0];
    expect(mailArg.to).toBe("priya@example.com");
    expect(mailArg.text).toContain("/contestant-portal?invite=invite-abc");
    expect(mailArg.text).not.toContain("/waiver");
  });

  it("marks the application Cast and stamps castEventId", async () => {
    await POST({
      request: makeRequest(validBody),
    } as Parameters<typeof POST>[0]);
    const patchCall = mocks.fsPatch.mock.calls.find(
      ([path]) => path === "applications/app-123",
    );
    expect(patchCall).toBeDefined();
    expect(patchCall?.[1]).toMatchObject({
      status: "Cast",
      castEventId: "nyc-2099-12-31",
    });
  });
});
