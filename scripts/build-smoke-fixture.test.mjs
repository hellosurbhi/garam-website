// @vitest-environment node
import { expect, it } from "vitest";
import {
  existsSync,
  readdirSync,
  mkdtempSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { loadEnv } from "vite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildFixture, fixtureEnvironment, isFixtureEntrypoint } from "./build-smoke-fixture.mjs";

it("drops inherited credentials and preload hooks while preserving process essentials", () => {
  const env = fixtureEnvironment({
    PATH: "/bin",
    FIREBASE_ADMIN_PRIVATE_KEY: "dummy-private",
    PUBLIC_FIREBASE_API_KEY: "dummy-real",
    NODE_OPTIONS: "--require dummy",
    EVENTBRITE_API_TOKEN: "dummy-token",
    VERCEL_TOKEN: "dummy-vercel",
  });
  expect(env.PATH).toBe("/bin");
  expect(env.PUBLIC_FIREBASE_PROJECT_ID).toBe("demo-garam-masala");
  expect(JSON.stringify(env)).not.toContain("dummy");
  expect(env.NODE_OPTIONS).toBeUndefined();
});
it("points the build at an empty env directory and removes it afterward", async () => {
  let directory;
  await buildFixture(
    async ({ vite, configFile }) => {
      expect(configFile).toBe(false);
      directory = vite.envDir;
      expect(readdirSync(directory)).toEqual([]);
      // Use a unique prefix so inherited runner configuration cannot affect this assertion.
      expect(
        loadEnv("production", directory, "GMD_FIXTURE_ENV_PROBE_"),
      ).toEqual({});
    },
    async () => ({ vite: { envDir: "/must-not-load" } }),
  );
  expect(existsSync(directory)).toBe(false);
});
it("removes the isolated env directory even when the build fails", async () => {
  let directory;
  await expect(
    buildFixture(
      async ({ vite }) => {
        directory = vite.envDir;
        throw new Error("fixture build failed");
      },
      async () => ({}),
    ),
  ).rejects.toThrow("fixture build failed");
  expect(existsSync(directory)).toBe(false);
});

it("loads the real config without attempting environment-file access during bootstrap", () => {
  const probe = `
    import fs from "node:fs";
    import { basename } from "node:path";
    import { syncBuiltinESMExports } from "node:module";
    let attempts = 0;
    function guard(path) {
      if (/^\\.env(?:\\.|$)/.test(basename(String(path)))) {
        attempts++;
        throw new Error("Environment file access forbidden in fixture config");
      }
    }
    for (const key of ["readFileSync", "statSync", "lstatSync", "accessSync", "existsSync"]) {
      const original = fs[key];
      fs[key] = function(path, ...args) { guard(path); return original.call(this, path, ...args); };
    }
    for (const key of ["readFile", "stat", "lstat", "access"]) {
      const original = fs.promises[key];
      fs.promises[key] = function(path, ...args) { guard(path); return original.call(this, path, ...args); };
    }
    syncBuiltinESMExports();
    const { loadFixtureConfig } = await import(${JSON.stringify(new URL("./build-smoke-fixture.mjs", import.meta.url).href)});
    const config = await loadFixtureConfig();
    if (!config.site) throw new Error("Real config was not loaded");
    console.log("GMD_ENV_PROBE:" + attempts);
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", probe],
    {
      encoding: "utf8",
      timeout: 20000,
      env: fixtureEnvironment(process.env),
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("GMD_ENV_PROBE:0");
}, 25000);

it("recognizes a symlinked entry path without building during helper imports", () => {
  const directory = mkdtempSync(join(tmpdir(), "gmd-entry-probe-"));
  try {
    const alias = join(directory, "fixture.mjs");
    symlinkSync(
      fileURLToPath(new URL("./build-smoke-fixture.mjs", import.meta.url)),
      alias,
    );
    expect(isFixtureEntrypoint(alias)).toBe(true);
    expect(isFixtureEntrypoint(fileURLToPath(import.meta.url))).toBe(false);
    expect(isFixtureEntrypoint(undefined)).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
