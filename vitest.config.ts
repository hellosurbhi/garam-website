import { defineConfig } from "vitest/config";
import react from "@astrojs/react";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
  },
});
