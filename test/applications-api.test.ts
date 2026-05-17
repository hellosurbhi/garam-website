import { describe, it, expect, beforeEach, vi } from "vitest";

const verifyAdminToken = vi.fn().mockResolvedValue("admin-1");
const getApplications = vi.fn();
const getDoc = vi.fn();
const updateDoc = vi.fn();

const queryApi = {
  orderBy: vi.fn(() => queryApi),
  limit: vi.fn(() => queryApi),
  startAfter: vi.fn(() => queryApi),
  get: (...args: unknown[]) => getApplications(...args),
};

const docApi = {
  get: (...args: unknown[]) => getDoc(...args),
  update: (...args: unknown[]) => updateDoc(...args),
};

const collectionApi = {
  orderBy: (...args: unknown[]) => queryApi.orderBy(...args),
  doc: vi.fn(() => docApi),
};

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken,
}));

vi.mock("@/lib/firebaseAdmin", () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => collectionApi),
  })),
}));

const { GET, PATCH } = await import("@/pages/api/applications");

function makeContext(request: Request) {
  return { request } as Parameters<typeof GET>[0];
}

function makeAuthedRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", "Bearer admin-token");

  return new Request(url, {
    ...init,
    headers,
  });
}

describe("applications admin API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAdminToken.mockResolvedValue("admin-1");
  });

  it("requires an allowlisted admin token", async () => {
    verifyAdminToken.mockResolvedValue(null);

    const res = await GET(
      makeContext(makeAuthedRequest("https://example.com/api/applications")),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(getApplications).not.toHaveBeenCalled();
  });

  it("lists applications through the server credential", async () => {
    getApplications.mockResolvedValue({
      size: 1,
      docs: [
        {
          id: "app-1",
          data: () => ({
            name: "Priya",
            status: "New",
            submittedAt: { seconds: 1760000000, nanoseconds: 12 },
          }),
        },
      ],
    });

    const res = await GET(
      makeContext(makeAuthedRequest("https://example.com/api/applications")),
    );

    expect(res.status).toBe(200);
    expect(queryApi.orderBy).toHaveBeenCalledWith("submittedAt", "desc");
    expect(queryApi.limit).toHaveBeenCalledWith(24);
    await expect(res.json()).resolves.toMatchObject({
      applications: [
        {
          id: "app-1",
          name: "Priya",
          status: "New",
          submittedAt: { seconds: 1760000000, nanoseconds: 12 },
        },
      ],
      cursor: "app-1",
      hasMore: false,
    });
  });

  it("updates only approved application fields", async () => {
    getDoc.mockResolvedValueOnce({ exists: true }).mockResolvedValueOnce({
      data: () => ({
        name: "Priya",
        status: "Contacted",
        notes: "Good fit",
        submittedAt: { seconds: 1760000000, nanoseconds: 0 },
      }),
    });

    const res = await PATCH(
      makeContext(
        makeAuthedRequest("https://example.com/api/applications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "app-1",
            patch: { status: "Contacted", notes: "Good fit" },
          }),
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(collectionApi.doc).toHaveBeenCalledWith("app-1");
    expect(updateDoc).toHaveBeenCalledWith({
      status: "Contacted",
      notes: "Good fit",
    });
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      application: { id: "app-1", status: "Contacted", notes: "Good fit" },
    });
  });
});
