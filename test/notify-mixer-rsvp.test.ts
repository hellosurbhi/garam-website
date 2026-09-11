import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/zohoMailer", () => ({
  sendMail: mockSend,
}));

// Every request in this suite shares the "unknown" IP bucket; without this
// mock a run against a real Upstash instance rate limits the later tests.
vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

const { POST } = await import("@/pages/api/notify-mixer-rsvp");

function makeRequest(
  body: unknown,
  origin = "https://garammasaladating.com",
): Request {
  return new Request("https://garammasaladating.com/api/notify-mixer-rsvp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

const validBody = {
  name: "Priya Sharma",
  email: "priya@example.com",
  source: "cuffing-season",
};

describe("notify-mixer-rsvp handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.NOTIFICATION_EMAIL = "admin@example.com";
    mockSend.mockResolvedValue({ id: "email-id" });
  });

  it("returns 500 when NOTIFICATION_EMAIL is missing", async () => {
    delete import.meta.env.NOTIFICATION_EMAIL;
    const res = await POST(makeContext(makeRequest(validBody)));
    expect(res.status).toBe(500);
  });

  it("returns 403 when Origin header is absent", async () => {
    const res = await POST(makeContext(makeRequest(validBody, "")));
    expect(res.status).toBe(403);
  });

  it("returns 403 when Origin is not in the allowlist", async () => {
    const res = await POST(
      makeContext(makeRequest(validBody, "https://evil.com")),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, name: "" })),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is malformed", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, email: "notanemail" })),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when source is not a recognized page", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, source: "homepage" })),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 and sends mail for cuffing-season", async () => {
    const res = await POST(makeContext(makeRequest(validBody)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("returns 200 and sends mail for singles-mixers", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, source: "singles-mixers" })),
    );
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("sends mail to the configured NOTIFICATION_EMAIL address", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("admin@example.com");
  });

  it("subject includes the name and a human readable source label", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toContain("Priya Sharma");
    expect(callArgs.subject).toContain("Cuffing Season");
  });

  it("email HTML escapes HTML special characters in name", async () => {
    await POST(
      makeContext(
        makeRequest({ ...validBody, name: "<script>alert('xss')</script>" }),
      ),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("skips mail for the synthetic monitor submission", async () => {
    const res = await POST(
      makeContext(
        makeRequest({
          ...validBody,
          email: "synthetic-monitor@garammasaladating.com",
        }),
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synthetic).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 500 and pages ops when sendMail throws", async () => {
    mockSend.mockRejectedValue(new Error("Network failure"));
    const res = await POST(makeContext(makeRequest(validBody)));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to send notification");
  });
});
