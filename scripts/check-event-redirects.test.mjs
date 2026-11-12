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

it("reports every failing alias in one run", async () => {
  const more = [
    ...routes,
    {
      src: "^/events/another-date$",
      status: 308,
      headers: { Location: "/events/canonical-date" },
    },
  ];
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  await expect(checkEventRedirects(more, { fetch })).rejects.toThrow(
    /philadelphia[\s\S]*another-date/,
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("continues after transport errors and limits concurrent requests to four", async () => {
  const many = Array.from({ length: 9 }, (_, i) => ({
    src: `^/events/alias-${i}$`,
    status: 308,
    headers: { Location: `/events/canonical-${i}` },
  }));
  let active = 0;
  let peak = 0;
  const fetch = vi.fn(async (source) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    if (source.pathname.endsWith("-0")) throw new Error("network unavailable");
    return new Response(null, {
      status: 308,
      headers: {
        Location: source.pathname.replace("alias", "canonical") + source.search,
      },
    });
  });
  await expect(checkEventRedirects(many, { fetch })).rejects.toThrow(
    "network unavailable",
  );
  expect(fetch).toHaveBeenCalledTimes(9);
  expect(peak).toBe(4);
});
