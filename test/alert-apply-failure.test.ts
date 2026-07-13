import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mockSend is evaluated before vi.mock hoisting
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/zohoMailer", () => ({
  sendMail: mockSend,
}));

// Import handler after mocking
const { POST } = await import("@/pages/api/alert-apply-failure");

function makeRequest(body: unknown): Request {
  return new Request(
    "https://garammasaladating.com/api/alert-apply-failure",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

const validReport = {
  stage: "submit",
  errorMessage:
    "Firebase Storage: User does not have permission to access 'photos/x.jpeg'. (storage/unauthorized)",
  pageUrl: "https://garammasaladating.com/apply",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
  applicant: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+1 555 0100",
    instagram: "applicant_fixture_1",
  },
};

describe("alert-apply-failure handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.NOTIFICATION_EMAIL = "admin@example.com";
    mockSend.mockResolvedValue(undefined);
  });

  it("emails the producer immediately with stage, error and applicant contact", async () => {
    const res = await POST(makeContext(makeRequest(validReport)));
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0];
    expect(mail.to).toBe("admin@example.com");
    expect(mail.subject).toContain("APPLY FORM FAILURE");
    expect(mail.html).toContain("storage/unauthorized");
    expect(mail.html).toContain("priya@example.com");
    expect(mail.text).toContain("Instagram: @applicant_fixture_1");
  });

  it("accepts a report without applicant contact fields", async () => {
    const res = await POST(
      makeContext(
        makeRequest({ stage: "react_boundary", errorMessage: "boom" }),
      ),
    );
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].html).toContain(
      "No contact fields were filled in yet",
    );
  });

  it("rejects unknown stages", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validReport, stage: "other" })),
    );
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects an empty error message", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validReport, errorMessage: "" })),
    );
    expect(res.status).toBe(400);
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

  it("returns 500 when NOTIFICATION_EMAIL is missing", async () => {
    delete import.meta.env.NOTIFICATION_EMAIL;
    const res = await POST(makeContext(makeRequest(validReport)));
    expect(res.status).toBe(500);
  });

  it("still returns 200 when the mail send fails (client fires and forgets)", async () => {
    mockSend.mockRejectedValue(new Error("SMTP down"));
    const res = await POST(makeContext(makeRequest(validReport)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(false);
  });
});
