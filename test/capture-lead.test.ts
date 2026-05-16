import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

const { enforceRateLimit } = await import("@/lib/rateLimit");

vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn().mockResolvedValue("access-token"),
}));

const { POST } = await import("@/pages/api/capture-lead");

function makeRequest(
  body: unknown,
  contentType = "application/json",
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request("https://garammasaladating.com/api/capture-lead", {
    method: "POST",
    headers: { "Content-Type": contentType, ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

function firestoreBody(fetchSpy: ReturnType<typeof vi.spyOn>, callIndex = 0) {
  const init = fetchSpy.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body)) as {
    fields: Record<string, { stringValue?: string; doubleValue?: number }>;
  };
}

describe("capture-lead handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    import.meta.env.LEAD_UPDATE_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    delete import.meta.env.LEAD_UPDATE_SECRET;
    delete import.meta.env.KIT_API_SECRET;
  });

  it("writes sanitized lead fields including click ids", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "projects/test-project/databases/(default)/documents/leads/lead123",
        }),
        { status: 200 },
      ),
    );

    const res = await POST(
      makeContext(
        makeRequest(
          {
            email: " Person@Example.com ",
            city: " Manhattan ",
            source: "x".repeat(60),
            sourcePage: "/cities/manhattan",
            landingPage: "/",
            fbclid: "fb-click-id",
            gclid: "g-click-id",
            sourceCitySlug: "manhattan",
          },
          "application/json",
          {
            "x-vercel-ip-latitude": "40.7128",
            "x-vercel-ip-longitude": "-74.0060",
          },
        ),
      ),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      id: "lead123",
      updateToken: expect.any(String),
    });

    const { fields } = firestoreBody(fetchSpy);
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer access-token",
    });
    expect(fields.email.stringValue).toBe("person@example.com");
    expect(fields.city.stringValue).toBe("Manhattan");
    expect(fields.source.stringValue).toHaveLength(50);
    expect(fields.sourcePage.stringValue).toBe("/cities/manhattan");
    expect(fields.fbclid.stringValue).toBe("fb-click-id");
    expect(fields.gclid.stringValue).toBe("g-click-id");
    expect(fields.sourceCitySlug.stringValue).toBe("manhattan");
  });

  it("retries without click ids when deployed Firestore rules reject them", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rules reject", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "projects/test-project/databases/(default)/documents/leads/lead456",
          }),
          { status: 200 },
        ),
      );

    const res = await POST(
      makeContext(
        makeRequest({
          email: "person@example.com",
          source: "popup",
          sourcePage: "/",
          landingPage: "/",
          fbclid: "fb-click-id",
          gclid: "g-click-id",
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      id: "lead456",
      updateToken: expect.any(String),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(firestoreBody(fetchSpy, 0).fields.fbclid.stringValue).toBe(
      "fb-click-id",
    );
    expect(firestoreBody(fetchSpy, 1).fields).not.toHaveProperty("fbclid");
    expect(firestoreBody(fetchSpy, 1).fields).not.toHaveProperty("gclid");
  });

  it("syncs successful leads to Kit without changing the response", async () => {
    import.meta.env.KIT_API_SECRET = "kit-secret";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "projects/test-project/databases/(default)/documents/leads/lead789",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const res = await POST(
      makeContext(
        makeRequest({
          email: "person@example.com",
          city: "San Francisco",
          source: "city-page",
          sourcePage: "/cities/san-francisco",
          landingPage: "/",
          utmSource: "instagram",
          utmMedium: "social",
          utmCampaign: "spring",
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      id: "lead789",
      updateToken: expect.any(String),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(fetchSpy.mock.calls[1][0]).toBe(
      "https://api.kit.com/v4/subscribers",
    );
    const kitInit = fetchSpy.mock.calls[1][1] as RequestInit;
    const kitBody = JSON.parse(String(kitInit.body)) as {
      email_address: string;
      tags: string[];
      fields: Record<string, string>;
    };
    expect(kitBody.email_address).toBe("person@example.com");
    expect(kitBody.tags).toEqual([
      "website-lead",
      "san-francisco",
      "instagram",
    ]);
    expect(kitBody.fields).toMatchObject({
      city: "San Francisco",
      source_page: "/cities/san-francisco",
      landing_page: "/",
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "spring",
    });
  });

  it("returns 400 for malformed email before writing to Firestore", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await POST(
      makeContext(
        makeRequest({
          email: "not-an-email",
          source: "popup",
          sourcePage: "/",
        }),
      ),
    );

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("includes an updateToken when LEAD_UPDATE_SECRET is set", async () => {
    import.meta.env.LEAD_UPDATE_SECRET = "test-secret";
    try {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            name: "projects/p/databases/d/documents/leads/lead123",
          }),
          { status: 200 },
        ),
      );

      const res = await POST(
        makeContext(
          makeRequest({ email: "lead@example.com", source: "popup" }),
        ),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; updateToken?: string };
      expect(body.id).toBe("lead123");
      expect(body.updateToken).toBeDefined();
      const { verifyLeadToken } = await import("@/lib/leadToken");
      expect(verifyLeadToken(body.updateToken!)).toBe("lead123");
    } finally {
      delete import.meta.env.LEAD_UPDATE_SECRET;
    }
  });

  it("short-circuits with 429 before any Firestore write when rate limited", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
      }),
    );

    const res = await POST(
      makeContext(makeRequest({ email: "lead@example.com", source: "popup" })),
    );

    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
