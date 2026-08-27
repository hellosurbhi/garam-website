import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Dedicated config for the Firebase emulator rules tests. They are excluded
// from the default vitest run (and therefore from pre-commit) because they
// need the emulator; run them with `npm run test:rules`, and CI runs them on
// every PR.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/rules/**/*.rules-test.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
