import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const vercelJson = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf-8"),
);

describe("vercel.json redirects", () => {
  it("has a redirects array", () => {
    expect(Array.isArray(vercelJson.redirects)).toBe(true);
    expect(vercelJson.redirects.length).toBeGreaterThan(0);
  });

  it("has a www→apex permanent redirect", () => {
    const wwwRedirect = vercelJson.redirects.find(
      (r: Record<string, unknown>) =>
        Array.isArray(r.has) &&
        (r.has as Array<Record<string, string>>).some(
          (h) => h.type === "host" && h.value === "www.garammasaladating.com",
        ),
    );
    expect(wwwRedirect).toBeDefined();
    expect(wwwRedirect.permanent).toBe(true);
    expect(wwwRedirect.destination).toBe(
      "https://garammasaladating.com/:path*",
    );
  });
});
