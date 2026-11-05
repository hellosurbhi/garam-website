import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // WHY .claude/worktrees: Claude Code session worktrees live inside the
  // checkout and each carries its own tsconfig, so linting them made
  // typescript-eslint fail with "multiple candidate TSConfigRootDirs" and
  // blocked every pre-push. They are gitignored copies of other branches.
  globalIgnores([
    "dist",
    ".astro",
    ".stryker-tmp",
    ".worktrees",
    ".claude/worktrees",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]);
