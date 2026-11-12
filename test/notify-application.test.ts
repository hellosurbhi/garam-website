import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures the mocks exist before vi.mock hoisting
const mockSend = vi.hoisted(() => vi.fn());
const mockAlert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/zohoMailer", () => ({ sendMail: mockSend }));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mockAlert }));
vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

const { POST } = await import("@/pages/api/notify-application");
const { enforceRateLimit } = await import("@/lib/rateLimit");

function makeRequest(
  body: unknown,
  origin: string | null = "https://garammasaladating.com",
  raw?: string,
): Request {
  return new Request("https://garammasaladating.com/api/notify-application", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: raw ?? JSON.stringify(body),
  });
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

/** What a stale tab (pre-autosave script) still posts: the full old payload. */
const legacyBody = {
  name: "Priya Sharma",
  age: 27,
  gender: "Female",
  city: "New York",
  state: "NY",
  email: "priya@example.com",
  instagram: "applicant_fixture_1",
  pitch: "I love masala chai and long walks.",
  photoPaths: ["photos/0f8b3a52-1c9e-4a7d-9b21-6de84c3f5a10.jpg"],
};

describe("notify-application (legacy receipt-only endpoint)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    mockSend.mockResolvedValue({ id: "email-id" });
  });

  it("sends exactly one email: the receipt to the applicant", async () => {
    const res = await POST(makeContext(makeRequest(legacyBody)));
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe("priya@example.com");
  });

  it("never emails the producer per application (the daily digest does that)", async () => {
    await POST(makeContext(makeRequest(legacyBody)));
    const recipients = mockSend.mock.calls.map((c) => c[0].to);
    expect(recipients).toEqual(["priya@example.com"]);
  });

  it("accepts under-18 and absurd ages: nothing rejects on content", async () => {
    for (const age of [7, 17, 200, "abc"]) {
      const res = await POST(makeContext(makeRequest({ ...legacyBody, age })));
      expect(res.status).toBe(200);
    }
    expect(mockSend).toHaveBeenCalledTimes(4);
  });

  it("accepts a payload with only the three receipt fields", async () => {
    const res = await POST(
      makeContext(makeRequest({ name: "A", email: "a@example.com" })),
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when the receipt cannot be addressed (no email)", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...legacyBody, email: "" })),
    );
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(makeContext(makeRequest(null, undefined, "{nope")));
    expect(res.status).toBe(400);
  });

  it("returns 403 for a foreign origin", async () => {
    const res = await POST(
      makeContext(makeRequest(legacyBody, "https://evil.example.com")),
    );
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns the limiter's response when rate limited", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      new Response("slow down", { status: 429 }),
    );
    const res = await POST(makeContext(makeRequest(legacyBody)));
    expect(res.status).toBe(429);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("on mail failure: 500 and an alert naming the stage and the raw error", async () => {
    mockSend.mockRejectedValueOnce(new Error("SMTP 535 auth failed"));
    const res = await POST(makeContext(makeRequest(legacyBody)));
    expect(res.status).toBe(500);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0][0]).toMatchObject({
      flow: "apply",
      stage: "welcome_email_legacy",
      errorMessage: "SMTP 535 auth failed",
    });
  });
});
