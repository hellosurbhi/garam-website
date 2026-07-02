import { describe, it, expect, beforeEach, vi } from "vitest";

let contestantRecord: Record<string, unknown> | null = null;

vi.mock("@/lib/portalToken", () => ({
  verifyPortalToken: vi.fn().mockResolvedValue({
    contestantId: "contestant-1",
  }),
}));

vi.mock("@/lib/firebaseAdmin", () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: contestantRecord !== null,
          data: () => contestantRecord,
        }),
      })),
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

const { GET } = await import("@/pages/api/portal-state");

function makeContext(
  cookie = "portal_session=token",
  url = "https://garammasaladating.com/api/portal-state",
) {
  return {
    request: new Request(url, {
      headers: { cookie },
    }),
  } as Parameters<typeof GET>[0];
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("portal-state handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contestantRecord = {
      firstName: "Priya",
      lastName: "Shah",
      role: "female",
      showCity: "New York",
      showDate: "2026-06-01",
      signedAtIso: "2026-05-15T12:00:00.000Z",
      waiverVersion: "2026-04-01",
      waiverTextHash: "abc123",
      signature: "Priya Shah",
    };
  });

  it("returns active state only after the contestant has signed a waiver", async () => {
    const res = await GET(makeContext());

    expect(res.status).toBe(200);
    expect(await readJson(res)).toMatchObject({
      state: "active",
      firstName: "Priya",
      role: "female",
      showCity: "New York",
      showDate: "2026-06-01",
    });
  });

  it("does not unlock prep for a session whose contestant lacks waiver fields", async () => {
    contestantRecord = {
      firstName: "Priya",
      role: "female",
      showCity: "New York",
      showDate: "2026-06-01",
    };

    const res = await GET(makeContext());

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ state: "no-access" });
  });

  it("treats legacy show and role links as direct contestant packet access", async () => {
    const res = await GET(
      makeContext(
        "",
        "https://garammasaladating.com/api/portal-state?show=manhattan-2026-06-01&role=female",
      ),
    );

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ state: "open" });
  });

  it("does not require a role on legacy show links", async () => {
    const res = await GET(
      makeContext(
        "",
        "https://garammasaladating.com/api/portal-state?show=manhattan-2026-06-01",
      ),
    );

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ state: "open" });
  });

  it("opens the direct contestant packet when the portal has no invite or session", async () => {
    const res = await GET(makeContext(""));

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ state: "open" });
  });

  it("does not expose hidden event details through legacy show links", async () => {
    const res = await GET(
      makeContext(
        "",
        "https://garammasaladating.com/api/portal-state?show=secret-city-2026-06-02&role=female",
      ),
    );

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ state: "open" });
  });
});
