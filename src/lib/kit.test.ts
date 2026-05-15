import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { addKitSubscriber } from "./kit";

describe("addKitSubscriber", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete import.meta.env.KIT_API_SECRET;
  });

  it("sends subscriber to Kit API with correct payload", async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);
    import.meta.env.KIT_API_SECRET = "test-secret";

    await addKitSubscriber("test@example.com", ["nyc", "ticket_drop"], {
      city: "manhattan",
      source_page: "/tickets",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.kit.com/v4/subscribers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
        }),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.email_address).toBe("test@example.com");
    expect(body.tags).toEqual(["nyc", "ticket_drop"]);
    expect(body.fields.city).toBe("manhattan");
  });

  it("skips if KIT_API_SECRET is not configured", async () => {
    import.meta.env.KIT_API_SECRET = "";
    await addKitSubscriber("test@example.com", ["nyc"]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("logs error but does not throw on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "error",
    } as Response);
    import.meta.env.KIT_API_SECRET = "test-secret";

    // Should not throw
    await expect(
      addKitSubscriber("bad@example.com", []),
    ).resolves.toBeUndefined();
  });

  it("sends tags as empty when no tags provided", async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);
    import.meta.env.KIT_API_SECRET = "test-secret";

    await addKitSubscriber("test@example.com", []);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.tags).toBeUndefined();
  });
});
