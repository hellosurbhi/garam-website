import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://garammasaladating.com",
  output: "static",
  trailingSlash: "never",
  adapter: vercel(),
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
