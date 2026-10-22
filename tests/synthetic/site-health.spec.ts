/**
 * Production site health, run every 15 minutes against the live deployment.
 *
 * Mocked tests cannot see a broken deploy: a route that never shipped, a
 * sitemap page that 404s, an internal link that lands on Vercel's error
 * page. This file asks the real site the same questions a visitor would.
 * Every check discovers its targets from the repo or the live sitemap, so a
 * new page or API file is covered the day it ships with no list to update.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test, expect, type APIRequestContext } from "@playwright/test";

const API_DIR = "src/pages/api";
const MAX_PAGES = 120;

/** Every non-test, non-dynamic API source file as { route, methods }. */
function discoverApiRoutes(): { route: string; methods: string[] }[] {
  const found: { route: string; methods: string[] }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== "_tests") walk(path);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      if (path.includes("[")) continue; // dynamic segments need a real slug
      const source = readFileSync(path, "utf8");
      const methods = [
        ...source.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g),
      ].map((m) => m[1]);
      if (methods.length === 0) continue;
      const route =
        "/api/" +
        relative(API_DIR, path)
          .replace(/\\/g, "/")
          .replace(/\.ts$/, "")
          .replace(/\/index$/, "");
      found.push({ route, methods });
    }
  };
  walk(API_DIR);
  return found;
}

/**
 * A route that exists but refuses an empty request answers 400/401/403/405 or
 * a JSON error. A route that did not deploy answers 404 (Astro or Vercel).
 * The only thing this check forbids is "not found" and server crashes.
 */
async function probe(
  request: APIRequestContext,
  route: string,
  method: string,
) {
  const res = await request.fetch(route, {
    method,
    headers: { "content-type": "application/json" },
    data: method === "GET" ? undefined : "{}",
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  return {
    status: res.status(),
    vercelError: res.headers()["x-vercel-error"] ?? "",
  };
}

test.describe("API routes are deployed", () => {
  for (const { route, methods } of discoverApiRoutes()) {
    for (const method of methods) {
      test(`${method} ${route} exists`, async ({ request }) => {
        const { status, vercelError } = await probe(request, route, method);
        expect(
          vercelError,
          `${method} ${route} hit a Vercel platform error`,
        ).toBe("");
        expect(
          status,
          `${method} ${route} is missing from the deploy`,
        ).not.toBe(404);
        expect(status, `${method} ${route} crashed`).toBeLessThan(500);
      });
    }
  }
});

async function sitemapPages(request: APIRequestContext): Promise<string[]> {
  const index = await request.get("/sitemap-index.xml");
  expect(index.status(), "sitemap-index.xml must load").toBe(200);
  const maps = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1],
  );
  expect(maps.length, "sitemap index lists no sitemaps").toBeGreaterThan(0);
  const urls = new Set<string>();
  for (const map of maps) {
    const res = await request.get(new URL(map).pathname);
    expect(res.status(), `${map} must load`).toBe(200);
    for (const m of (await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls.add(new URL(m[1]).pathname);
    }
  }
  return [...urls];
}

test("every sitemap page loads and every internal link on it resolves", async ({
  request,
}) => {
  const pages = (await sitemapPages(request)).slice(0, MAX_PAGES);
  expect(pages.length, "sitemap lists no pages").toBeGreaterThan(5);

  const broken: string[] = [];
  const checked = new Map<string, number>();
  const check = async (path: string, from: string) => {
    if (!checked.has(path)) {
      const res = await request.get(path, {
        failOnStatusCode: false,
        maxRedirects: 5,
      });
      checked.set(path, res.status());
    }
    const status = checked.get(path) ?? 0;
    if (status >= 400) broken.push(`${path} (${status}) linked from ${from}`);
  };

  for (const page of pages) {
    const res = await request.get(page, { failOnStatusCode: false });
    if (res.status() !== 200) {
      broken.push(`${page} (${res.status()}) is in the sitemap`);
      continue;
    }
    const html = await res.text();
    const links = new Set(
      [...html.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)]
        .map((m) => m[1])
        .filter(
          (p) =>
            !p.startsWith("//") &&
            !/\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?|xml|txt)$/.test(p),
        ),
    );
    for (const link of links) await check(link, page);
  }
  expect(broken, `Broken pages or links:\n${broken.join("\n")}`).toEqual([]);
});
