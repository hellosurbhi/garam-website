import { beforeEach, describe, it, expect, vi } from "vitest";
import type { APIContext } from "astro";
vi.mock("@/lib/verifyToken", () => ({ verifyAdminToken: vi.fn() }));
vi.mock("@/lib/outreach/store", () => ({
  store: { get: vi.fn(), put: vi.fn(), list: vi.fn() },
}));
vi.mock("@/lib/outreach/gmail", () => ({
  configuredAccounts: vi.fn(() => []),
}));
import { verifyAdminToken } from "@/lib/verifyToken";
import { store } from "@/lib/outreach/store";
import { GET, POST } from "@/pages/api/admin/email/index";
import { defaultTemplates } from "@/data/outreach";
function ctx(body?: unknown) {
  return {
    request: new Request("https://example.org/api/admin/email", {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
    }),
  } as APIContext;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(store.get).mockResolvedValue(null);
  vi.mocked(store.list).mockResolvedValue([]);
  vi.mocked(store.put).mockResolvedValue(true);
});
describe("email admin authorization and writes", () => {
  it("denies unauthenticated reads and writes before accessing storage", async () => {
    expect((await GET(ctx())).status).toBe(401);
    expect((await POST(ctx({ action: "settings" }))).status).toBe(401);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });
  it("rejects enabling without the completed audience import", async () => {
    vi.mocked(verifyAdminToken).mockResolvedValue("admin");
    const res = await POST(
      ctx({
        action: "settings",
        settings: { enabled: true, templates: defaultTemplates },
        version: null,
      }),
    );
    expect(res.status).toBe(409);
    expect(store.put).not.toHaveBeenCalled();
  });
  it("rejects stale saves instead of overwriting another browser's changes", async () => {
    vi.mocked(verifyAdminToken).mockResolvedValue("admin");
    vi.mocked(store.put).mockResolvedValue(false);
    const res = await POST(
      ctx({
        action: "settings",
        settings: { enabled: false, templates: defaultTemplates },
        version: "old-version",
      }),
    );
    expect(res.status).toBe(409);
  });
  it("saves reusable copy without enabling sends", async () => {
    vi.mocked(verifyAdminToken).mockResolvedValue("admin");
    const res = await POST(
      ctx({
        action: "settings",
        settings: { enabled: false, templates: defaultTemplates },
        version: null,
      }),
    );
    expect(res.status).toBe(200);
    expect(store.put).toHaveBeenCalledWith(
      "emailSettings/default",
      { enabled: false, templates: defaultTemplates, importedAt: null },
      null,
    );
  });
});
