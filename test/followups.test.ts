import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fsGet: vi.fn(),
  fsPatch: vi.fn(),
  fsAdd: vi.fn(),
  fsListAll: vi.fn(),
  fsQuery: vi.fn(),
  sendMail: vi.fn(),
  schedulingFollowup: vi.fn(() => ({
    subject: "s",
    text: "t",
    html: "<p>h</p>",
  })),
  waiverNudge: vi.fn(() => ({ subject: "s", text: "t", html: "<p>h</p>" })),
  hostBriefing: vi.fn(() => ({ subject: "s", text: "t", html: "<p>h</p>" })),
}));

vi.mock("@/lib/firestoreRest", () => ({
  fsGet: mocks.fsGet,
  fsPatch: mocks.fsPatch,
  fsAdd: mocks.fsAdd,
  fsListAll: mocks.fsListAll,
  fsQuery: mocks.fsQuery,
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/data/emails", () => ({
  schedulingFollowup: mocks.schedulingFollowup,
  waiverNudge: mocks.waiverNudge,
  hostBriefing: mocks.hostBriefing,
}));

const CRON_SECRET = "test-cron-secret-xyz";

const { GET } = await import("@/pages/api/cron/followups");

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return new Request("https://garammasaladating.com/api/cron/followups", {
    headers,
  });
}

async function run() {
  const req = makeRequest(`Bearer ${CRON_SECRET}`);
  return GET({ request: req } as Parameters<typeof GET>[0]);
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgoIso(days: number): string {
  return hoursAgoIso(days * 24);
}

// Matches the source's own `todayNYC()` computation so tests aren't
// date-fragile and don't hardcode a timezone-shifted literal.
function todayNYC(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

describe("followups GET /api/cron/followups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.CRON_SECRET = CRON_SECRET;
    mocks.fsListAll.mockResolvedValue([]);
    mocks.fsGet.mockResolvedValue(null);
    mocks.fsPatch.mockResolvedValue(undefined);
    mocks.fsAdd.mockResolvedValue("event-id");
    mocks.fsQuery.mockResolvedValue([]);
    mocks.sendMail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete import.meta.env.CRON_SECRET;
    delete import.meta.env.HOST_BRIEFING_EMAILS;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest();
    const res = await GET({ request: req } as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const req = makeRequest("Bearer wrong-secret");
    const res = await GET({ request: req } as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret has wrong length", async () => {
    const req = makeRequest(`Bearer ${CRON_SECRET}X`);
    const res = await GET({ request: req } as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct secret and no applications", async () => {
    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await GET({ request: req } as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  describe("pass 1: scheduling follow-up", () => {
    it("sends a follow-up when contacted 48h+ ago with no scheduling done", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a1",
          email: "x@example.com",
          name: "X",
          status: "Contacted",
          contactedAt: hoursAgoIso(50),
        },
      ]);
      const res = await run();
      const body = await res.json();
      expect(body.schedulingFollowups).toBe(1);
      expect(mocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "x@example.com" }),
      );
      expect(mocks.fsPatch).toHaveBeenCalledWith(
        "applications/a1",
        expect.objectContaining({ followupSentAt: expect.any(String) }),
      );
      expect(mocks.fsAdd).toHaveBeenCalledWith(
        "applications/a1/events",
        expect.objectContaining({ type: "followup_sent" }),
      );
    });

    it("does not send a follow-up when contacted less than 48h ago", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a1",
          email: "x@example.com",
          status: "Contacted",
          contactedAt: hoursAgoIso(10),
        },
      ]);
      const body = await (await run()).json();
      expect(body.schedulingFollowups).toBe(0);
      expect(mocks.sendMail).not.toHaveBeenCalled();
    });

    it("skips statuses in the skip list (e.g. Rejected)", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a1",
          email: "x@example.com",
          status: "Rejected",
          contactedAt: hoursAgoIso(50),
        },
      ]);
      const body = await (await run()).json();
      expect(body.schedulingFollowups).toBe(0);
    });

    it("caps scheduling follow-ups at MAX_PER_RUN (50)", async () => {
      const apps = Array.from({ length: 55 }, (_, i) => ({
        id: `a${i}`,
        email: `x${i}@example.com`,
        status: "Contacted",
        contactedAt: hoursAgoIso(50),
      }));
      mocks.fsListAll.mockResolvedValue(apps);
      const body = await (await run()).json();
      expect(body.schedulingFollowups).toBe(50);
    });
  });

  describe("pass 2: waiver nudge", () => {
    it("sends a waiver nudge for Cast applicants invited 48h+ ago with no waiver signed", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a2",
          email: "y@example.com",
          name: "Y",
          status: "Cast",
          invitedAt: hoursAgoIso(50),
        },
      ]);
      const body = await (await run()).json();
      expect(body.waiverNudges).toBe(1);
      expect(mocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "y@example.com" }),
      );
      expect(mocks.fsPatch).toHaveBeenCalledWith(
        "applications/a2",
        expect.objectContaining({ waiverNudgeSentAt: expect.any(String) }),
      );
    });

    it("resolves the latest invite link when castEventId is present", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a2",
          email: "y@example.com",
          name: "Y",
          status: "Cast",
          invitedAt: hoursAgoIso(50),
          castEventId: "evt-1",
        },
      ]);
      mocks.fsQuery.mockResolvedValue([{ id: "invite-123" }]);
      await run();
      expect(mocks.waiverNudge).toHaveBeenCalledWith(
        "Y",
        "https://garammasaladating.com/contestant-portal?invite=invite-123",
      );
    });

    it("does not send a waiver nudge to non-Cast applicants", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a2",
          email: "y@example.com",
          status: "Contacted",
          invitedAt: hoursAgoIso(50),
        },
      ]);
      const body = await (await run()).json();
      expect(body.waiverNudges).toBe(0);
    });

    it("does not re-nudge once a waiver is signed", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a2",
          email: "y@example.com",
          status: "Cast",
          invitedAt: hoursAgoIso(50),
          waiverSignedAt: hoursAgoIso(10),
        },
      ]);
      const body = await (await run()).json();
      expect(body.waiverNudges).toBe(0);
    });
  });

  describe("pass 3: auto-decay", () => {
    it("decays applicants whose follow-up went unanswered for 7+ days", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a3",
          status: "Contacted",
          followupSentAt: daysAgoIso(8),
        },
      ]);
      const body = await (await run()).json();
      expect(body.autoDecayed).toBe(1);
      expect(mocks.fsPatch).toHaveBeenCalledWith("applications/a3", {
        status: "No Response",
      });
      expect(mocks.fsAdd).toHaveBeenCalledWith(
        "applications/a3/events",
        expect.objectContaining({ type: "status_auto_decayed" }),
      );
    });

    it("does not decay when the follow-up was sent less than 7 days ago", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a3",
          status: "Contacted",
          followupSentAt: daysAgoIso(2),
        },
      ]);
      const body = await (await run()).json();
      expect(body.autoDecayed).toBe(0);
    });

    it("does not decay an applicant who has since been scheduled", async () => {
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a3",
          status: "Contacted",
          followupSentAt: daysAgoIso(8),
          scheduledAt: hoursAgoIso(1),
        },
      ]);
      const body = await (await run()).json();
      expect(body.autoDecayed).toBe(0);
    });
  });

  describe("pass 4: host briefing", () => {
    it("sends the briefing to every configured host when applications are scheduled in the next 24h", async () => {
      mocks.fsGet.mockResolvedValue({ lastBriefingDate: "2020-01-01" });
      mocks.fsListAll.mockResolvedValue([
        {
          id: "a4",
          name: "Z",
          city: "NYC",
          scheduledAt: hoursAgoIso(-2), // 2h in the future
          calBookingUrl: "https://cal.com/x",
        },
      ]);
      import.meta.env.HOST_BRIEFING_EMAILS =
        "host1@example.com,host2@example.com";
      const body = await (await run()).json();
      expect(body.briefingSent).toBe(true);
      expect(body.briefingSkipped).toBe(false);
      expect(mocks.sendMail).toHaveBeenCalledTimes(2);
      expect(mocks.fsPatch).toHaveBeenCalledWith("systemConfig/cron", {
        lastBriefingDate: todayNYC(),
      });
    });

    it("skips the briefing when one was already sent today", async () => {
      mocks.fsGet.mockResolvedValue({ lastBriefingDate: todayNYC() });
      mocks.fsListAll.mockResolvedValue([
        { id: "a4", scheduledAt: hoursAgoIso(-2) },
      ]);
      const body = await (await run()).json();
      expect(body.briefingSkipped).toBe(true);
      expect(mocks.sendMail).not.toHaveBeenCalled();
    });

    it("records lastBriefingDate even when nothing is scheduled in the next 24h", async () => {
      mocks.fsGet.mockResolvedValue({ lastBriefingDate: "2020-01-01" });
      mocks.fsListAll.mockResolvedValue([]);
      const body = await (await run()).json();
      expect(body.briefingSent).toBe(false);
      expect(body.briefingSkipped).toBe(false);
      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.fsPatch).toHaveBeenCalledWith("systemConfig/cron", {
        lastBriefingDate: todayNYC(),
      });
    });
  });
});
