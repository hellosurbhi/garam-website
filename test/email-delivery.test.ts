import { beforeEach, it, expect, vi } from "vitest";
import type { APIContext } from "astro";
vi.mock("@/lib/verifyToken", () => ({ verifyAdminToken: vi.fn() }));
vi.mock("@/lib/outreach/store", () => ({
  store: { get: vi.fn(), put: vi.fn(), list: vi.fn() },
}));
import { verifyAdminToken } from "@/lib/verifyToken";
import { store } from "@/lib/outreach/store";
import { POST } from "@/pages/api/admin/email/delivery";
const body = {
  showId: "chicago",
  milestone: "announcement",
  id: "a".repeat(64),
  version: "v1",
  outcome: "not_sent",
};
function context() {
  return {
    request: new Request("https://example.org/api/admin/email/delivery", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  } as APIContext;
}
beforeEach(() => {
  vi.resetAllMocks();
});
it("requires admin authentication to authorize a resend", async () => {
  expect((await POST(context())).status).toBe(401);
  expect(store.put).not.toHaveBeenCalled();
});
it("cannot override an in-flight delivery", async () => {
  vi.mocked(verifyAdminToken).mockResolvedValue("admin");
  vi.mocked(store.get).mockResolvedValue({
    version: "v1",
    value: { status: "sending", attemptedAt: Date.now() },
  });
  expect((await POST(context())).status).toBe(409);
  expect(store.put).not.toHaveBeenCalled();
});
it("records who resolved an uncertain delivery and queues an explicit retry", async () => {
  vi.mocked(verifyAdminToken).mockResolvedValue("admin");
  vi.mocked(store.get).mockResolvedValue({
    version: "v1",
    value: { status: "uncertain", attemptedAt: 0 },
  });
  vi.mocked(store.put).mockResolvedValue(true);
  expect((await POST(context())).status).toBe(200);
  expect(store.put).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      status: "deferred",
      resolvedBy: "admin",
      resolution: "not_sent",
    }),
    "v1",
  );
});
it("does not change a delivery that has already been confirmed", async () => {
  vi.mocked(verifyAdminToken).mockResolvedValue("admin");
  vi.mocked(store.get).mockResolvedValue({
    version: "v1",
    value: { status: "sent", attemptedAt: 0 },
  });
  expect((await POST(context())).status).toBe(409);
  expect(store.put).not.toHaveBeenCalled();
});
