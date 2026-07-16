import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

const mocks = vi.hoisted(() => ({
  fsQuery: vi.fn(),
  fsPatch: vi.fn(),
  fsAdd: vi.fn(),
  fsDeleteFields: vi.fn(),
}));

// cal.ts imports firestoreRest via a relative path, but Vitest's mock
// registry keys on the resolved module id, so aliasing the mock here
// (matching repo convention) still intercepts it.
vi.mock("@/lib/firestoreRest", () => ({
  fsQuery: mocks.fsQuery,
  fsPatch: mocks.fsPatch,
  fsAdd: mocks.fsAdd,
  fsDeleteFields: mocks.fsDeleteFields,
}));

const SECRET = "test-cal-webhook-secret";

const { POST } = await import("@/pages/api/webhooks/cal");

function sign(rawBody: string): string {
  return createHmac("sha256", SECRET).update(rawBody).digest("hex");
}

function makeRequest(
  rawBody: string,
  opts: { signature?: string | null } = {},
): Request {
  const headers: Record<string, string> = {};
  const signature =
    opts.signature === null ? undefined : (opts.signature ?? sign(rawBody));
  if (signature !== undefined) headers["X-Cal-Signature-256"] = signature;
  return new Request("https://garammasaladating.com/api/webhooks/cal", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

const basePayload = {
  triggerEvent: "BOOKING_CREATED",
  payload: {
    id: 12345,
    uid: "abc-uid",
    startTime: "2026-08-01T18:00:00.000Z",
    attendees: [{ email: "applicant@example.com" }],
    calLink: "https://cal.com/garammasala/interview/abc-uid",
  },
};

describe("cal webhook POST /api/webhooks/cal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.CAL_WEBHOOK_SECRET = SECRET;
    mocks.fsQuery.mockResolvedValue([]);
    mocks.fsPatch.mockResolvedValue(undefined);
    mocks.fsAdd.mockResolvedValue("event-id");
    mocks.fsDeleteFields.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete import.meta.env.CAL_WEBHOOK_SECRET;
  });

  it("returns 401 when the signature header is missing", async () => {
    const raw = JSON.stringify(basePayload);
    const res = await POST(makeContext(makeRequest(raw, { signature: null })));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature is wrong", async () => {
    const raw = JSON.stringify(basePayload);
    const res = await POST(
      makeContext(makeRequest(raw, { signature: "0".repeat(64) })),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when CAL_WEBHOOK_SECRET is not configured", async () => {
    delete import.meta.env.CAL_WEBHOOK_SECRET;
    const raw = JSON.stringify(basePayload);
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a body that isn't valid JSON", async () => {
    const raw = "not json at all";
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid json");
  });

  it("returns 200 and ignores unknown event types", async () => {
    const raw = JSON.stringify({ ...basePayload, triggerEvent: "PING" });
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(200);
    expect(mocks.fsQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when the booking has no attendee email", async () => {
    const raw = JSON.stringify({
      ...basePayload,
      payload: { ...basePayload.payload, attendees: [] },
    });
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing attendee email");
  });

  it("returns 200 and acknowledges when no application matches the attendee email", async () => {
    mocks.fsQuery.mockResolvedValue([]);
    const raw = JSON.stringify(basePayload);
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(mocks.fsPatch).not.toHaveBeenCalled();
  });

  it("transitions a New application to Contacted on first booking", async () => {
    mocks.fsQuery.mockResolvedValue([
      { id: "app-1", status: "New", emailNormalized: "applicant@example.com" },
    ]);
    const raw = JSON.stringify(basePayload);
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(200);
    expect(mocks.fsPatch).toHaveBeenCalledWith(
      "applications/app-1",
      expect.objectContaining({ calBookingId: 12345, status: "Contacted" }),
    );
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "applications/app-1/events",
      expect.objectContaining({ type: "booking_created" }),
    );
  });

  it("leaves an already-Contacted application's status unchanged", async () => {
    mocks.fsQuery.mockResolvedValue([
      {
        id: "app-1",
        status: "Contacted",
        emailNormalized: "applicant@example.com",
      },
    ]);
    const raw = JSON.stringify(basePayload);
    await POST(makeContext(makeRequest(raw)));
    const patchedFields = mocks.fsPatch.mock.calls[0][1];
    expect(patchedFields.status).toBeUndefined();
  });

  it("updates the scheduled time on a matching reschedule", async () => {
    mocks.fsQuery.mockResolvedValue([
      { id: "app-1", status: "Contacted", calBookingId: 12345 },
    ]);
    const raw = JSON.stringify({
      ...basePayload,
      triggerEvent: "BOOKING_RESCHEDULED",
      payload: {
        ...basePayload.payload,
        startTime: "2026-08-02T18:00:00.000Z",
      },
    });
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(200);
    expect(mocks.fsPatch).toHaveBeenCalledWith(
      "applications/app-1",
      expect.objectContaining({
        scheduledAt: "2026-08-02T18:00:00.000Z",
      }),
    );
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "applications/app-1/events",
      expect.objectContaining({ type: "booking_rescheduled" }),
    );
  });

  it("ignores a reschedule whose calBookingId doesn't match the stored booking", async () => {
    mocks.fsQuery.mockResolvedValue([
      { id: "app-1", status: "Contacted", calBookingId: 99999 },
    ]);
    const raw = JSON.stringify({
      ...basePayload,
      triggerEvent: "BOOKING_RESCHEDULED",
    });
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(200);
    expect(mocks.fsPatch).not.toHaveBeenCalled();
    expect(mocks.fsAdd).not.toHaveBeenCalled();
  });

  it("clears scheduling fields on a matching cancellation", async () => {
    mocks.fsQuery.mockResolvedValue([
      { id: "app-1", status: "Contacted", calBookingId: 12345 },
    ]);
    const raw = JSON.stringify({
      ...basePayload,
      triggerEvent: "BOOKING_CANCELLED",
    });
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(200);
    expect(mocks.fsDeleteFields).toHaveBeenCalledWith("applications/app-1", [
      "scheduledAt",
      "calBookingUrl",
      "calBookingId",
    ]);
    expect(mocks.fsAdd).toHaveBeenCalledWith(
      "applications/app-1/events",
      expect.objectContaining({ type: "booking_cancelled" }),
    );
  });

  it("ignores a cancellation whose calBookingId doesn't match the stored booking", async () => {
    mocks.fsQuery.mockResolvedValue([
      { id: "app-1", status: "Contacted", calBookingId: 99999 },
    ]);
    const raw = JSON.stringify({
      ...basePayload,
      triggerEvent: "BOOKING_CANCELLED",
    });
    const res = await POST(makeContext(makeRequest(raw)));
    expect(res.status).toBe(200);
    expect(mocks.fsDeleteFields).not.toHaveBeenCalled();
  });
});
