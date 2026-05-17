import { describe, it, expect } from "vitest";

const { POST } = await import("@/pages/api/contestant-portal-auth");

function makeContext(request: Request) {
  return { request } as Parameters<typeof POST>[0];
}

describe("contestant-portal-auth handler", () => {
  it("returns 410 because the legacy password endpoint is retired", async () => {
    const res = await POST(
      makeContext(
        new Request(
          "https://garammasaladating.com/api/contestant-portal-auth",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: "2026-06-15", sig: "a".repeat(64) }),
          },
        ),
      ),
    );

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toEqual({
      error:
        "This legacy contestant portal auth endpoint has been retired. Use /contestant-portal packet links.",
    });
  });
});
