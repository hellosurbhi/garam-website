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
  },
});

// export default defineConfig({
//   test: {
//     environment: 'jsdom',
//     globals: true,
//     setupFiles: './test/setup.ts',
//     coverage: {
//       provider: 'v8',
//       reporter: ['text', 'lcov'],
//       thresholds: {
//         branches: 70,
//         functions: 70,
//         lines: 70,
//       }
//     },
//   },
// })
