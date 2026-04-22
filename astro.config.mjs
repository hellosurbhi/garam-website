import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { execSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import { journalPostsPublished } from "./src/data/journal/index.ts";

const SITE = "https://garammasaladating.com";
const TODAY_STR = new Date().toISOString().slice(0, 10);

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

/** Return the most recent git modification date across all city data files. */
function getCityLastmod() {
  const cityFiles = readdirSync("src/data/cities")
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts")
    .map((f) => `src/data/cities/${f}`);
  const dates = cityFiles.map(getGitDate).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : "2026-01-01";
}

const cityLastmod = getCityLastmod();

/** Map each static page URL to its source file for git-based lastmod. */
const STATIC_PAGE_FILES = {
  [`${SITE}/`]: "src/pages/index.astro",
  [`${SITE}/apply`]: "src/pages/apply.astro",
  [`${SITE}/tickets`]: "src/pages/tickets.astro",
  [`${SITE}/faq`]: "src/pages/faq.astro",
  [`${SITE}/hosts`]: "src/pages/hosts.astro",
  [`${SITE}/corporate`]: "src/pages/corporate.astro",
  [`${SITE}/sponsorship`]: "src/pages/sponsorship.astro",
  [`${SITE}/links`]: "src/pages/links.astro",
  [`${SITE}/privacy`]: "src/pages/privacy.astro",
  [`${SITE}/terms`]: "src/pages/terms.astro",
  [`${SITE}/waiver`]: "src/pages/waiver.astro",
  [`${SITE}/cities`]: "src/pages/cities/index.astro",
  [`${SITE}/journal`]: "src/pages/journal/index.astro",
  [`${SITE}/journal/situationship-masterclass`]: "src/pages/journal/situationship-masterclass.astro",
};

const staticLastmod = Object.fromEntries(
  Object.entries(STATIC_PAGE_FILES).map(([url, file]) => [
    url,
    getGitDate(file) || "2026-01-01",
  ])
);

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

/** Assign sitemap priority by page type. */
function getPriority(url) {
  if (url === `${SITE}/`) return 1.0;
  if (/\/(tickets|apply|faq|hosts|corporate|sponsorship)$/.test(url)) return 0.8;
  if (/\/(journal|cities)$/.test(url)) return 0.7;
  if (/\/journal\//.test(url)) return 0.6;
  if (/\/cities\//.test(url)) return 0.5;
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
        if (page.includes("/admin") || page.includes("/contestant-prep"))
          return false;
        if (page.includes("/journal/")) {
          if (page.includes("situationship-masterclass")) return true;
          return contentLastmod.has(page);
        }
        return true;
      },
      serialize(item) {
        const lastmod =
          contentLastmod.get(item.url) ??
          (item.url.includes("/cities/")
            ? new Date(cityLastmod)
            : new Date(staticLastmod[item.url] || "2026-01-01"));
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
    optimizeDeps: {
      esbuildOptions: {
        define: {
          "process.env.NODE_ENV": '"development"',
        },
      },
    },
    plugins: [gitDatesPlugin()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
