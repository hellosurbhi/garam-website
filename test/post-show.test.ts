import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fsPatch: vi.fn(),
  fsAdd: vi.fn(),
  fsListAll: vi.fn(),
  sendMail: vi.fn(),
  postShow: vi.fn(() => ({ subject: "s", text: "t", html: "<p>h</p>" })),
}));

vi.mock("@/lib/firestoreRest", () => ({
  fsPatch: mocks.fsPatch,
  fsAdd: mocks.fsAdd,
  fsListAll: mocks.fsListAll,
}));
vi.mock("@/lib/zohoMailer", () => ({ sendMail: mocks.sendMail }));
vi.mock("@/data/emails", () => ({ postShow: mocks.postShow }));

const CRON_SECRET = "test-post-show-secret";

const { GET } = await import("@/pages/api/cron/post-show");

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return new Request("https://garammasaladating.com/api/cron/post-show", {
    headers,
  });
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    status: "Participated",
    email: "contestant@example.com",
    name: "Priya",
    participatedAt: daysAgoIso(5), // within the D3-D10 window
    ...overrides,
  };
}

describe("post-show GET /api/cron/post-show", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.CRON_SECRET = CRON_SECRET;
    mocks.fsListAll.mockResolvedValue([]);
    mocks.fsPatch.mockResolvedValue(undefined);
    mocks.fsAdd.mockResolvedValue("event-id");
    mocks.sendMail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete import.meta.env.CRON_SECRET;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET({
      request: makeRequest(),
    } as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the secret is wrong", async () => {
    const res = await GET({
      request: makeRequest("Bearer wrong-secret"),
    } as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 200 with sent: 0 when there are no applications", async () => {
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(0);
  });

  it("sends the post-show email for a Participated applicant within the D3 to D10 window", async () => {
    mocks.fsListAll.mockResolvedValue([makeApp()]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "contestant@example.com" }),
    );
    expect(mocks.fsPatch).toHaveBeenCalledWith(
      "applications/app-1",
      expect.objectContaining({ postShowSentAt: expect.any(String) }),
    );
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "applications/app-1/events",
      expect.objectContaining({ type: "post_show_sent" }),
    );
  });

  it("skips applicants whose status isn't Participated", async () => {
    mocks.fsListAll.mockResolvedValue([makeApp({ status: "Cast" })]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("skips applicants who already received the post-show email", async () => {
    mocks.fsListAll.mockResolvedValue([
      makeApp({ postShowSentAt: daysAgoIso(1) }),
    ]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("skips soft-deleted applicants", async () => {
    mocks.fsListAll.mockResolvedValue([makeApp({ deletedAt: daysAgoIso(1) })]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
  });

  it("skips applicants with no participatedAt timestamp", async () => {
    mocks.fsListAll.mockResolvedValue([makeApp({ participatedAt: undefined })]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
  });

  it("skips applicants who participated less than 3 days ago", async () => {
    mocks.fsListAll.mockResolvedValue([
      makeApp({ participatedAt: daysAgoIso(1) }),
    ]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("skips applicants who participated more than 10 days ago", async () => {
    mocks.fsListAll.mockResolvedValue([
      makeApp({ participatedAt: daysAgoIso(11) }),
    ]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("skips applicants with no email on file", async () => {
    mocks.fsListAll.mockResolvedValue([makeApp({ email: undefined })]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("continues without incrementing sent when sendMail throws", async () => {
    mocks.fsListAll.mockResolvedValue([makeApp()]);
    mocks.sendMail.mockRejectedValue(new Error("SMTP down"));
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mocks.fsPatch).not.toHaveBeenCalled();
  });

  it("processes multiple eligible applicants in one run", async () => {
    mocks.fsListAll.mockResolvedValue([
      makeApp({ id: "app-1", email: "a@example.com" }),
      makeApp({ id: "app-2", email: "b@example.com" }),
    ]);
    const res = await GET({
      request: makeRequest(`Bearer ${CRON_SECRET}`),
    } as Parameters<typeof GET>[0]);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });
});
