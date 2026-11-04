import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContext } from "astro/middleware";
import { GET } from "@/pages/api/geo";

function requestGeo(city?: string) {
  const headers = new Headers({
    "x-vercel-ip-country-region": "NY",
    "x-vercel-ip-country": "US",
    "x-vercel-ip-timezone": "America/New_York",
  });
  if (city !== undefined) headers.set("x-vercel-ip-city", city);
  return GET(
    createContext({
      request: new Request("https://garammasaladating.com/api/geo", {
        headers,
      }),
      defaultLocale: "en",
    }),
  );
}

describe("geo endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["New%20York%20City", "New York City"],
    ["S%C3%A3o%20Paulo", "São Paulo"],
    ["New York City", "New York City"],
    ["City%2520Name", "City%20Name"],
    ["%E0%A4%A", undefined],
    ["%", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("returns a readable optional city for %s", async (header, expected) => {
    const response = await requestGeo(header);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    const data = await response.json();
    expect(data.city).toBe(expected);
    expect(data).toMatchObject({
      region: "NY",
      country: "US",
      timezone: "America/New_York",
    });
    if (expected === undefined) expect(data).not.toHaveProperty("city");
  });

  it("retains the local development location stub", async () => {
    vi.stubEnv("DEV", true);
    const response = await requestGeo();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      city: "New York",
      country: "US",
    });
  });
});
