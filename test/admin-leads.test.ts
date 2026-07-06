import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAdminToken: vi.fn(),
  getFirestoreAccessToken: vi.fn(),
}));

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken: mocks.verifyAdminToken,
}));
vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: mocks.getFirestoreAccessToken,
}));

const { GET } = await import("@/pages/api/admin/leads");

function makeContext(query = "") {
  const url = new URL(`https://garammasaladating.com/api/admin/leads${query}`);
  const request = new Request(url, {
    headers: { authorization: "Bearer admin-token" },
  });
  return { request, url } as Parameters<typeof GET>[0];
}

function firestoreDoc(id: string, fields: Record<string, string>) {
  return {
    name: `projects/p/databases/(default)/documents/leads/${id}`,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, { stringValue: v }]),
    ),
  };
}

describe("admin/leads GET /api/admin/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAdminToken.mockResolvedValue("admin-uid");
    mocks.getFirestoreAccessToken.mockResolvedValue("fs-token");
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          documents: [
            firestoreDoc("1", {
              email: "a@x.com",
              phone: "+15551110000",
              city: "New York",
              source: "city-waitlist",
              createdAt: "2026-07-01T00:00:00Z",
            }),
            firestoreDoc("2", {
              email: "b@x.com",
              city: "Austin",
              source: "popup",
              createdAt: "2026-07-02T00:00:00Z",
            }),
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    vi.unstubAllGlobals();
  });

  it("returns 401 without a valid admin token", async () => {
    mocks.verifyAdminToken.mockResolvedValue(null);
    const res = await GET(makeContext());
    expect(res.status).toBe(401);
  });

  it("returns all leads sorted by city then newest", async () => {
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    // Austin sorts before New York
    expect(body.leads[0].city).toBe("Austin");
    expect(body.leads[1].city).toBe("New York");
    expect(body.leads[1].phone).toBe("+15551110000");
  });

  it("filters by city", async () => {
    const res = await GET(makeContext("?city=austin"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.leads[0].email).toBe("b@x.com");
  });

  it("exports CSV with a header and attachment disposition", async () => {
    const res = await GET(makeContext("?format=csv"));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toContain("Email");
    expect(text).toContain("a@x.com");
  });
});
