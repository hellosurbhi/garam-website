import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

interface VercelConfig {
  headers: { headers: { key: string; value: string }[] }[];
}

/**
 * The browser PUTs photos to a signed https://storage.googleapis.com URL. If
 * the site's Content-Security-Policy omits that host from connect-src, every
 * direct upload is blocked in production while every mocked test stays green
 * (the smoke lane runs on a preview with no vercel.json headers).
 */
describe("CSP allows the signed photo upload host", () => {
  const config = JSON.parse(
    readFileSync("vercel.json", "utf8"),
  ) as VercelConfig;
  const csp = config.headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === "Content-Security-Policy")?.value;

  it("lists storage.googleapis.com in connect-src", () => {
    const connect = csp
      ?.split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src"));
    expect(connect).toContain("https://storage.googleapis.com");
  });
});
