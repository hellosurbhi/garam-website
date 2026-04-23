import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { execSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import { journalPostsPublished } from "./src/data/journal/index.ts";
import { cities } from "./src/data/cities/index.ts";
import { events } from "./src/data/events.ts";

const SITE = "https://garammasaladating.com";
const TODAY_STR = new Date().toISOString().slice(0, 10);
const DEFAULT_LASTMOD = new Date(TODAY_STR);

/** Return the date of the last git commit that touched a file, or null. */
function getGitDate(filePath) {
  try {
    const out = execSync(`git log --format=%aI -1 -- "${filePath}"`, {
      encoding: "utf8",
    }).trim();
    return out ? out.slice(0, 10) : null; // YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * Scan every journal data file, extract slug strings via regex,
 * and map each slug to the git modification date of its source file.
 * Falls back gracefully when git history is unavailable.
 */
function buildGitDatesMap() {
  const map = {};
  const journalFiles = readdirSync("src/data/journal")
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts")
    .map((f) => `src/data/journal/${f}`);

  for (const file of journalFiles) {
    const gitDate = getGitDate(file);
    if (!gitDate) continue;
    const content = readFileSync(file, "utf8");
    for (const [, slug] of content.matchAll(/\bslug:\s*["']([^"']+)["']/g)) {
      map[slug] = gitDate;
    }
  }
  return map;
}

const gitDates = buildGitDatesMap();

/** Map each city slug to the git modification date of its source file. */
function buildCityLastmodMap() {
  const map = {};
  const cityFiles = readdirSync("src/data/cities")
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts")
    .map((f) => `src/data/cities/${f}`);
  for (const file of cityFiles) {
    const gitDate = getGitDate(file) || TODAY_STR;
    const content = readFileSync(file, "utf8");
    for (const [, slug] of content.matchAll(/\bslug:\s*["']([^"']+)["']/g)) {
      map[slug] = gitDate;
    }
  }
  return map;
}

const cityLastmodMap = buildCityLastmodMap();

/**
 * Scan src/pages/ and build a URL → git-lastmod map for all non-dynamic static pages.
 * Skips dynamic routes ([slug].astro), 404, and admin-only pages.
 * New pages are picked up automatically — no manual registration needed.
 */
function buildStaticLastmod() {
  const SKIP = new Set(["404.astro", "admin.astro", "contestant-portal.astro"]);
  const files = readdirSync("src/pages", { recursive: true })
    .map((f) => f.toString())
    .filter((f) => f.endsWith(".astro") && !f.includes("[") && !SKIP.has(f.split("/").pop()));

  const map = {};
  for (const f of files) {
    const urlPath = f
      .replace(/\.astro$/, "")
      .replace(/\/index$/, "")
      .replace(/^index$/, "");
    const url = urlPath ? `${SITE}/${urlPath}` : `${SITE}/`;
    map[url] = getGitDate(`src/pages/${f}`) || TODAY_STR;
  }
  return map;
}

const staticLastmod = buildStaticLastmod();

/** Vite plugin that exposes the git-dates map as a virtual ES module. */
function gitDatesPlugin() {
  const virtualId = "virtual:git-dates";
  const resolvedId = "\0" + virtualId;
  return {
    name: "vite-plugin-git-dates",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        return `export const gitDates = ${JSON.stringify(gitDates)};`;
      }
    },
  };
}

/** Pick the later of the hardcoded dateModified and the git modification date, capped at today. */
function effectiveDate(hardcoded, slug) {
  const git = gitDates[slug];
  const best = git && git > hardcoded ? git : hardcoded;
  return best > TODAY_STR ? TODAY_STR : best;
}

// Build URL → lastmod map using git-aware effective dateModified values
const contentLastmod = new Map(
  journalPostsPublished.map((p) => [
    `${SITE}/journal/${p.slug}`,
    new Date(effectiveDate(p.dateModified, p.slug)),
  ])
);

/** City slugs that have at least one upcoming confirmed event. */
const citiesWithEvents = new Set(
  events
    .filter((e) => !e.hidden && e.isoDate && e.isoDate >= TODAY_STR && e.url && e.citySlug)
    .map((e) => e.citySlug),
);

/** Assign sitemap priority by page type. */
function getPriority(url) {
  if (url === `${SITE}/`) return 1.0;
  if (/\/(tickets|apply|faq|hosts|corporate|sponsorship)$/.test(url)) return 0.8;
  if (/\/(journal|cities)$/.test(url)) return 0.7;
  if (/\/journal\//.test(url)) return 0.6;
  if (/\/cities\//.test(url)) {
    const slug = url.split("/cities/")[1];
    const city = cities[slug];
    if (city?.status === "active" || citiesWithEvents.has(slug)) return 0.6;
    return 0.4;
  }
  if (/\/(links|privacy|terms|waiver)$/.test(url)) return 0.3;
  return 0.5;
}

/** Assign crawl frequency hints by page type. */
function getChangefreq(url) {
  if (url === `${SITE}/`) return "daily";
  if (/\/(journal|cities)$/.test(url)) return "weekly";
  if (/\/(journal|cities)\//.test(url)) return "monthly";
  return "monthly";
}

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "never",
  compressHTML: true,
  build: {
    inlineStylesheets: "auto",
  },
  adapter: vercel(),
  redirects: {
    "/south-asian-dating-tips": "/journal",
    "/south-asian-dating-tips/how-to-find-love-as-a-desi-in-new-york":
      "/journal/how-to-find-love-as-a-desi-in-new-york",
    "/south-asian-dating-tips/how-to-find-someone-before-your-parents-arrange-marry-you-off":
      "/journal/how-to-find-someone-before-your-parents-arrange-marry-you-off",
    "/south-asian-dating-tips/why-going-with-the-flow-is-ruining-your-dating-life":
      "/journal/why-going-with-the-flow-is-ruining-your-dating-life",
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        if (page.includes("?")) return false;
        if (
          page.includes("/admin") ||
          page.includes("/contestant-prep") ||
          page.includes("/waiver")
        )
          return false;
        if (page.includes("/journal/")) {
          if (page.includes("situationship-masterclass")) return true;
          return contentLastmod.has(page);
        }
        return true;
      },
      serialize(item) {
        let lastmod = contentLastmod.get(item.url);
        if (!lastmod) {
          if (item.url.includes("/cities/")) {
            const slug = item.url.split("/cities/")[1];
            const cityDate = cityLastmodMap[slug];
            if (!cityDate) console.warn(`[sitemap] no lastmod for city slug: ${slug}`);
            lastmod = cityDate ? new Date(cityDate) : DEFAULT_LASTMOD;
          } else {
            const staticDate = staticLastmod[item.url];
            if (!staticDate) console.warn(`[sitemap] unmapped page: ${item.url}`);
            lastmod = staticDate ? new Date(staticDate) : DEFAULT_LASTMOD;
          }
        }
        return {
          ...item,
          priority: getPriority(item.url),
          lastmod,
          changefreq: getChangefreq(item.url),
        };
      },
    }),
  ],
  vite: {
    define: {
      "process.env.NODE_ENV": '"development"',
    },
    plugins: [gitDatesPlugin()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
