import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { journalPostsPublished } from "./src/data/journal/index.ts";
import { tipPosts } from "./src/data/tips.ts";

const SITE = "https://garammasaladating.com";

// Build URL → lastmod map from content that carries real dateModified values
const contentLastmod = new Map([
  ...journalPostsPublished.map((p) => [
    `${SITE}/journal/${p.slug}`,
    new Date(p.dateModified),
  ]),
  ...tipPosts.map((p) => [
    `${SITE}/south-asian-dating-tips/${p.slug}`,
    new Date(p.dateModified),
  ]),
]);

const buildDate = new Date();

/** Assign sitemap priority by page type, with content-specific lastmod where available. */
function getPriority(url) {
  if (url === `${SITE}/`) return 1.0;
  if (/\/(tickets|apply|faq|hosts)$/.test(url)) return 0.8;
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
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
