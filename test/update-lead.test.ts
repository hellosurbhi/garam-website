import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { POST } = await import("@/pages/api/update-lead");
const { issueLeadToken } = await import("@/lib/leadToken");

function makeRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("https://garammasaladating.com/api/update-lead", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(body),
  });
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

function mockFirestoreOk() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{}", { status: 200 }));
}

describe("update-lead handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    delete import.meta.env.LEAD_UPDATE_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    delete import.meta.env.LEAD_UPDATE_SECRET;
  });

  it("rejects non-JSON content types", async () => {
    const res = await POST(
      makeContext(
        makeRequest({ id: "lead123", phone: "5551234567" }, "text/plain"),
      ),
    );
    expect(res.status).toBe(400);
  });

  it("requires a phone number", async () => {
    const res = await POST(makeContext(makeRequest({ id: "lead123" })));
    expect(res.status).toBe(400);
  });

  describe("legacy path (LEAD_UPDATE_SECRET unset)", () => {
    it("patches the caller-supplied doc id", async () => {
      const fetchSpy = mockFirestoreOk();

      const res = await POST(
        makeContext(makeRequest({ id: "lead123", phone: "5551234567" })),
      );

      expect(res.status).toBe(200);
      const url = String(fetchSpy.mock.calls[0][0]);
      expect(url).toContain("/documents/leads/lead123?");
    });

    it("requires an id", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await POST(makeContext(makeRequest({ phone: "5551234567" })));
      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("token path (LEAD_UPDATE_SECRET set)", () => {
    beforeEach(() => {
      import.meta.env.LEAD_UPDATE_SECRET = "test-secret";
    });

    it("patches the token-derived doc id and ignores the body id", async () => {
      const fetchSpy = mockFirestoreOk();
      const token = issueLeadToken("token-lead");

      const res = await POST(
        makeContext(
          makeRequest({ id: "attacker-lead", token, phone: "5551234567" }),
        ),
      );

      expect(res.status).toBe(200);
      const url = String(fetchSpy.mock.calls[0][0]);
      expect(url).toContain("/documents/leads/token-lead?");
      expect(url).not.toContain("attacker-lead");
    });

    it("rejects a missing token with 401 before any Firestore call", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await POST(
        makeContext(makeRequest({ id: "lead123", phone: "5551234567" })),
      );

      expect(res.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects an invalid token with 401", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const res = await POST(
        makeContext(makeRequest({ token: "bogus", phone: "5551234567" })),
      );

      expect(res.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it("returns a generic error without Firestore detail on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("firestore internal path leak", { status: 403 }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(
      makeContext(makeRequest({ id: "lead123", phone: "5551234567" })),
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe("Failed to update lead");
    expect(body.detail).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
