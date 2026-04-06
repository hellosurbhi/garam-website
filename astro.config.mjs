import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://garammasaladating.com",
  output: "static",
  trailingSlash: "never",
  adapter: vercel(),
  integrations: [react(), sitemap()],
  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
