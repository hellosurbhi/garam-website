import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
    exclude: [
      "node_modules/**",
      "tests/smoke/**",
      ".stryker-tmp/**",
      "dist/**",
      "playwright-report/**",
      ".vercel/**",
    ],
  },
});
