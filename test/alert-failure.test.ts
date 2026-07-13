import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mockSend is evaluated before vi.mock hoisting
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/zohoMailer", () => ({
  sendMail: mockSend,
}));

// Import handler after mocking
const { POST } = await import("@/pages/api/alert-failure");

function makeRequest(
  body: unknown,
  origin: string | null = "https://garammasaladating.com",
): Request {
  return new Request("https://garammasaladating.com/api/alert-failure", {
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

const validReport = {
  flow: "apply",
  stage: "submit",
  errorMessage:
    "Firebase Storage: User does not have permission to access 'photos/x.jpeg'. (storage/unauthorized)",
  pageUrl: "https://garammasaladating.com/apply",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
  contact: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+1 555 0100",
    instagram: "applicant_fixture_1",
  },
};

describe("alert-failure handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.NOTIFICATION_EMAIL = "admin@example.com";
    delete import.meta.env.ALERT_WEBHOOK_URL;
    mockSend.mockResolvedValue(undefined);
  });

  it("pages the producer immediately with flow, stage, error and contact", async () => {
    const res = await POST(makeContext(makeRequest(validReport)));
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0];
    expect(mail.to).toBe("admin@example.com");
    expect(mail.subject).toBe("FAILURE [apply/submit]");
    expect(mail.html).toContain("storage/unauthorized");
    expect(mail.html).toContain("priya@example.com");
    expect(mail.text).toContain("instagram: applicant_fixture_1");
  });

  it("rejects requests without an allowed origin", async () => {
    const res = await POST(makeContext(makeRequest(validReport, null)));
    expect(res.status).toBe(403);
    const evil = await POST(
      makeContext(makeRequest(validReport, "https://evil.example.com")),
    );
    expect(evil.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("accepts a report without contact fields (ops heartbeat shape)", async () => {
    const res = await POST(
      makeContext(
        makeRequest({
          flow: "ops",
          stage: "heartbeat",
          errorMessage:
            "Weekly pager test: if you received this, alerting works.",
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].subject).toBe("FAILURE [ops/heartbeat]");
  });

  it("rejects unknown flows and empty error messages", async () => {
    expect(
      (await POST(makeContext(makeRequest({ ...validReport, flow: "other" }))))
        .status,
    ).toBe(400);
    expect(
      (
        await POST(
          makeContext(makeRequest({ ...validReport, errorMessage: "" })),
        )
      ).status,
    ).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("escapes HTML in attacker-controlled fields", async () => {
    await POST(
      makeContext(
        makeRequest({
          ...validReport,
          errorMessage: "<script>alert(1)</script>",
        }),
      ),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("still returns 200 when the mail send fails (client fires and forgets)", async () => {
    mockSend.mockRejectedValue(new Error("SMTP down"));
    const res = await POST(makeContext(makeRequest(validReport)));
    expect(res.status).toBe(200);
  });

  it("also fires the push webhook when ALERT_WEBHOOK_URL is set", async () => {
    import.meta.env.ALERT_WEBHOOK_URL = "https://ntfy.sh/gmd-alerts";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));
    try {
      await POST(makeContext(makeRequest(validReport)));
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://ntfy.sh/gmd-alerts",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Title: "FAILURE apply/submit",
            Priority: "urgent",
          }),
        }),
      );
    } finally {
      fetchSpy.mockRestore();
      delete import.meta.env.ALERT_WEBHOOK_URL;
    }
  });
});
