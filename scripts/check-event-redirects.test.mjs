import { describe, expect, it, vi } from "vitest";
import { checkEventRedirects } from "./check-event-redirects.mjs";

const routes = [
  {
    src: "^/api/go/philadelphia-2026-09-27$",
    status: 308,
    headers: { Location: "/api/go/philadelphia-2026-10-04" },
  },
];
describe("live alias query verification", () => {
  it("checks the real hop without following the ticket destination", async () => {
    const fetch = vi.fn(async (source, options) => {
      expect(options.redirect).toBe("manual");
      return new Response(null, {
        status: 308,
        headers: { Location: routes[0].headers.Location + source.search },
      });
    });
    await checkEventRedirects(routes, { fetch, log: vi.fn() });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("fails when the redirect strips query parameters", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 308, headers: routes[0].headers }),
      );
    await expect(checkEventRedirects(routes, { fetch })).rejects.toThrow(
      "Lost utm_source",
    );
  });
  it("fails if the deployed alias is missing", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    await expect(checkEventRedirects(routes, { fetch })).rejects.toThrow(
      "Alias did not redirect",
    );
  });
  it("does not report an empty alias set as verified", async () => {
    const fetch = vi.fn();
    await expect(checkEventRedirects([], { fetch })).rejects.toThrow(
      "No generated event aliases",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
