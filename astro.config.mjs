import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { execSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import { journalPostsPublished } from "./src/data/journal/index.ts";
import { tipPosts } from "./src/data/tips.ts";

const SITE = "https://garammasaladating.com";

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
 * Scan every journal data file + tips.ts, extract slug strings via regex,
 * and map each slug to the git modification date of its source file.
 * Falls back gracefully when git history is unavailable.
 */
function buildGitDatesMap() {
  const map = {};
  const journalFiles = readdirSync("src/data/journal")
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts")
    .map((f) => `src/data/journal/${f}`);

  for (const file of [...journalFiles, "src/data/tips.ts"]) {
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

/** Pick the later of the hardcoded dateModified and the git modification date. */
function effectiveDate(hardcoded, slug) {
  const git = gitDates[slug];
  return git && git > hardcoded ? git : hardcoded;
}

// Build URL → lastmod map using git-aware effective dateModified values
const contentLastmod = new Map([
  ...journalPostsPublished.map((p) => [
    `${SITE}/journal/${p.slug}`,
    new Date(effectiveDate(p.dateModified, p.slug)),
  ]),
  ...tipPosts.map((p) => [
    `${SITE}/south-asian-dating-tips/${p.slug}`,
    new Date(effectiveDate(p.dateModified, p.slug)),
  ]),
]);

const buildDate = new Date();

/** Assign sitemap priority by page type, with content-specific lastmod where available. */
function getPriority(url) {
  if (url === `${SITE}/`) return 1.0;
  if (/\/(tickets|apply|faq|hosts|corporate|sponsorship)$/.test(url))
    return 0.8;
  if (/\/(links|journal|south-asian-dating-tips)$/.test(url)) return 0.7;
  if (/\/(journal|south-asian-dating-tips)\//.test(url)) return 0.6;
  if (/\/cities\//.test(url)) return 0.4;
  return 0.5;
}

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "never",
  adapter: vercel(),
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes("/admin") && !page.includes("/contestant-prep"),
      serialize(item) {
        return {
          ...item,
          priority: getPriority(item.url),
          lastmod: contentLastmod.get(item.url) ?? buildDate,
        };
      },
    }),
  ],
  vite: {
    plugins: [gitDatesPlugin()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
