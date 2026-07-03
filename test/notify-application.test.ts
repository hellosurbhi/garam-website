import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mockSend is evaluated before vi.mock hoisting
const mockSend = vi.hoisted(() => vi.fn());

// Mock the resend module - Resend is used as a class (new Resend()), so must use function
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mockSend } };
  }),
}));

// Import handler after mocking
const { POST } = await import("@/pages/api/notify-application");

function makeRequest(
  body: unknown,
  origin = "https://garammasaladating.com",
): Request {
  return new Request("https://garammasaladating.com/api/notify-application", {
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
  age: 27,
  gender: "Female",
  orientation: "Straight",
  city: "New York",
  state: "NY",
  country: "USA",
  email: "priya@example.com",
  instagram: "applicant_fixture_1",
  community: "Hindu",
  income: "$50k–$100k",
  applicationType: "Self",
  referrerName: "",
  pitch: "I love masala chai and long walks.",
  photoUrls: ["https://example.com/photo.jpg"],
};

describe("notify-application handler", () => {
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

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, name: "" })),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 400 when instagram is missing", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, instagram: "" })),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, email: "" })),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 400 when email is malformed", async () => {
    const res = await POST(
      makeContext(makeRequest({ ...validBody, email: "notanemail" })),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 200 and sends email for valid self-application", async () => {
    const res = await POST(makeContext(makeRequest(validBody)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("sends email with correct subject for self-application", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toContain("Priya Sharma");
    expect(callArgs.subject).toContain("Self");
  });

  it("sends email with correct subject for nomination", async () => {
    await POST(
      makeContext(
        makeRequest({
          ...validBody,
          applicationType: "Nomination",
          referrerName: "Rahul Gupta",
        }),
      ),
    );
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toContain("Nomination");
  });

  it("sends email to the configured NOTIFICATION_EMAIL address", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("admin@example.com");
  });

  it("email HTML includes the applicant's name", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("Priya Sharma");
  });

  it("email HTML includes the instagram handle", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("applicant_fixture_1");
    expect(html).toContain("instagram.com/applicant_fixture_1");
  });

  it("email HTML escapes HTML special characters in name", async () => {
    await POST(
      makeContext(
        makeRequest({
          ...validBody,
          name: "<script>alert('xss')</script>",
        }),
      ),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("email HTML includes pitch section when pitch is provided", async () => {
    await POST(
      makeContext(
        makeRequest({
          ...validBody,
          pitch: "I am passionate about South Asian culture.",
        }),
      ),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("Pitch");
    expect(html).toContain("I am passionate about South Asian culture.");
  });

  it("email HTML omits pitch section when pitch is empty", async () => {
    await POST(makeContext(makeRequest({ ...validBody, pitch: "" })));
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("<h3");
  });

  it("email HTML shows 'Nomination' heading for nominations", async () => {
    await POST(
      makeContext(
        makeRequest({
          ...validBody,
          applicationType: "Nomination",
          referrerName: "Rahul Gupta",
        }),
      ),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("New Nomination");
    expect(html).not.toContain("Self-Application");
  });

  it("email HTML shows 'Self-Application' heading for self applications", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("New Self-Application");
  });

  it("email HTML includes 'Nominated by' row for nominations", async () => {
    await POST(
      makeContext(
        makeRequest({
          ...validBody,
          applicationType: "Nomination",
          referrerName: "Rahul Gupta",
        }),
      ),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("Nominated by");
    expect(html).toContain("Rahul Gupta");
  });

  it("email HTML omits 'Nominated by' row for self-applications", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("Nominated by");
  });

  it("email HTML includes photo link when photoUrls are provided", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("View Photo");
    expect(html).toContain("https://example.com/photo.jpg");
  });

  it("email HTML includes location built from city, state, country", async () => {
    await POST(makeContext(makeRequest(validBody)));
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("New York");
    expect(html).toContain("NY");
    expect(html).toContain("USA");
  });

  it("email HTML omits photo link for non-https URL", async () => {
    await POST(
      makeContext(
        makeRequest({
          ...validBody,
          photoUrls: ["http://example.com/photo.jpg"],
        }),
      ),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("View Photo");
  });

  it("email HTML omits photo link for invalid URL", async () => {
    await POST(
      makeContext(makeRequest({ ...validBody, photoUrls: ["not a url"] })),
    );
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("View Photo");
  });

  it("returns 500 when Resend throws an error", async () => {
    mockSend.mockRejectedValue(new Error("Network failure"));
    const res = await POST(makeContext(makeRequest(validBody)));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to send notification");
  });

  it("returns 403 when Origin header is absent", async () => {
    const res = await POST(makeContext(makeRequest(validBody, "")));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 when Origin is not in the allowlist", async () => {
    const res = await POST(
      makeContext(makeRequest(validBody, "https://evil.com")),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });
});
