import { it, expect, vi } from "vitest";
vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken: vi.fn(async () => "admin"),
}));
vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn(async () => "fixture"),
}));
// The live show list is not under test here; keep the route off Firestore.
vi.mock("@/lib/publishedEvents.server", () => ({
  getLiveEvents: vi.fn(async () => ({ events: [], allEvents: [] })),
}));
import { GET } from "@/pages/api/analytics";
it("excludes test leads and applications from the dashboard totals", async () => {
  const emails = [
    "customer@example.com",
    "draft-only@example.com",
    "synthetic-monitor+01234567-89ab-4cde-8fab-0123456789ab@garammasaladating.com",
  ];
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("syncMeta")) return new Response(null, { status: 404 });
      const docs = url.includes("orders?")
        ? []
        : emails.map((email, index) => ({
            name: `projects/test/databases/(default)/documents/test/${index}`,
            fields: {
              email: { stringValue: email },
              city: { stringValue: "Chicago" },
              source: { stringValue: "notify-modal" },
              status: {
                stringValue: email.startsWith("draft-only") ? "Draft" : "New",
              },
              createdAt: { stringValue: "2026-11-11T00:00:00Z" },
            },
          }));
      return new Response(JSON.stringify({ documents: docs }));
    });
  import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = "test";
  try {
    const url = new URL(
      "https://garammasaladating.com/api/analytics?period=all",
    );
    const response = await GET({ url, request: new Request(url) } as Parameters<
      typeof GET
    >[0]);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.applications.total).toBe(1);
    expect(body.applications.byStatus.Draft).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("synthetic-monitor");
    // The shared fixture feeds the leads list too: the draft-only address is a
    // plain lead there, the synthetic one is still excluded.
    expect(body.funnel.leadsByCity.Chicago).toBe(2);
  } finally {
    network.mockRestore();
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  }
});
