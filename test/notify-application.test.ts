import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// vi.hoisted ensures mockSend is evaluated before vi.mock hoisting
const mockSend = vi.hoisted(() => vi.fn());

// Mock the resend module - Resend is used as a class (new Resend()), so must use function
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mockSend } };
  }),
}));

// Import handler after mocking
const { default: handler } = await import("../api/notify-application");

function makeRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },
  };
  return res as unknown as VercelResponse & {
    statusCode: number;
    body: unknown;
    _headers: Record<string, string>;
  };
}

function makeReq(
  method: string,
  body: unknown = {}
): VercelRequest {
  return { method, body } as VercelRequest;
}

const validBody = {
  name: "Priya Sharma",
  age: 27,
  gender: "Female",
  orientation: "Straight",
  city: "New York",
  state: "NY",
  country: "USA",
  instagram: "priyasharma",
  community: "Hindu",
  income: "$50k–$100k",
  applicationType: "Self",
  referrerName: "",
  pitch: "I love masala chai and long walks.",
  photoUrl: "https://example.com/photo.jpg",
};

describe("notify-application handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NOTIFICATION_EMAIL = "admin@example.com";
    mockSend.mockResolvedValue({ id: "email-id" });
  });

  it("returns 405 for non-POST methods", async () => {
    const req = makeReq("GET");
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect((res.body as { error: string }).error).toBe("Method not allowed");
  });

  it("sets Allow header on 405 response", async () => {
    const req = makeReq("GET");
    const res = makeRes();
    await handler(req, res);
    expect(res._headers["Allow"]).toBe("POST");
  });

  it("returns 500 when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe("Server misconfigured");
  });

  it("returns 500 when NOTIFICATION_EMAIL is missing", async () => {
    delete process.env.NOTIFICATION_EMAIL;
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("returns 400 when name is missing", async () => {
    const req = makeReq("POST", { ...validBody, name: "" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe(
      "Missing required fields"
    );
  });

  it("returns 400 when instagram is missing", async () => {
    const req = makeReq("POST", { ...validBody, instagram: "" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 and sends email for valid self-application", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { sent: boolean }).sent).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("sends email with correct subject for self-application", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toContain("Priya Sharma");
    expect(callArgs.subject).toContain("Self");
  });

  it("sends email with correct subject for nomination", async () => {
    const req = makeReq("POST", {
      ...validBody,
      applicationType: "Nomination",
      referrerName: "Rahul Gupta",
    });
    const res = makeRes();
    await handler(req, res);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toContain("Nomination");
  });

  it("sends email to the configured NOTIFICATION_EMAIL address", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("admin@example.com");
  });

  it("email HTML includes the applicant's name", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("Priya Sharma");
  });

  it("email HTML includes the instagram handle", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("priyasharma");
    expect(html).toContain("instagram.com/priyasharma");
  });

  it("email HTML escapes HTML special characters in name", async () => {
    const req = makeReq("POST", {
      ...validBody,
      name: "<script>alert('xss')</script>",
    });
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("email HTML includes pitch section when pitch is provided", async () => {
    const req = makeReq("POST", {
      ...validBody,
      pitch: "I am passionate about South Asian culture.",
    });
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("Pitch");
    expect(html).toContain("I am passionate about South Asian culture.");
  });

  it("email HTML omits pitch section when pitch is empty", async () => {
    const req = makeReq("POST", { ...validBody, pitch: "" });
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    // No pitch heading when pitch is empty
    expect(html).not.toContain("<h3");
  });

  it("email HTML shows 'Nomination' heading for nominations", async () => {
    const req = makeReq("POST", {
      ...validBody,
      applicationType: "Nomination",
      referrerName: "Rahul Gupta",
    });
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("New Nomination");
    expect(html).not.toContain("Self-Application");
  });

  it("email HTML shows 'Self-Application' heading for self applications", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("New Self-Application");
  });

  it("email HTML includes 'Nominated by' row for nominations", async () => {
    const req = makeReq("POST", {
      ...validBody,
      applicationType: "Nomination",
      referrerName: "Rahul Gupta",
    });
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("Nominated by");
    expect(html).toContain("Rahul Gupta");
  });

  it("email HTML omits 'Nominated by' row for self-applications", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("Nominated by");
  });

  it("email HTML includes photo link when photoUrl is provided", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("View Photo");
    expect(html).toContain("https://example.com/photo.jpg");
  });

  it("email HTML includes location built from city, state, country", async () => {
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).toContain("New York");
    expect(html).toContain("NY");
    expect(html).toContain("USA");
  });

  it("email HTML omits photo link for non-https URL", async () => {
    const req = makeReq("POST", { ...validBody, photoUrl: "http://example.com/photo.jpg" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("View Photo");
  });

  it("email HTML omits photo link for invalid URL", async () => {
    const req = makeReq("POST", { ...validBody, photoUrl: "not a url" });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const html: string = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain("View Photo");
  });

  it("returns 500 when Resend throws an error", async () => {
    mockSend.mockRejectedValue(new Error("Network failure"));
    const req = makeReq("POST", validBody);
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe(
      "Failed to send notification"
    );
  });
});