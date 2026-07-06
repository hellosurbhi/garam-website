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

describe("followups GET /api/cron/followups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.CRON_SECRET = CRON_SECRET;
    mocks.fsListAll.mockResolvedValue([]);
    mocks.fsGet.mockResolvedValue(null);
    mocks.fsPatch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete import.meta.env.CRON_SECRET;
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
});
