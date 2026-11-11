import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function fixtureEnvironment(source) {
  const env = {};
  // WHY: executable, system and temporary paths are OS essentials. HOME can
  // expose user configuration; NODE_OPTIONS can preload code. Neither belongs
  // in this credential-free child.
  for (const key of ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR"])
    if (typeof source[key] === "string") env[key] = source[key];
  return {
    ...env,
    NODE_ENV: "production",
    ASTRO_TELEMETRY_DISABLED: "1",
    PUBLIC_FIREBASE_API_KEY: "AIzaSySmokeFixtureNotARealFirebaseKey00000",
    PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-garam-masala.firebaseapp.com",
    PUBLIC_FIREBASE_PROJECT_ID: "demo-garam-masala",
    PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-garam-masala.appspot.com",
    PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
    PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
  };
}

export async function loadFixtureConfig() {
  const { loadConfigFromFile } = await import("vite");
  const result = await loadConfigFromFile(
    { command: "build", mode: "production" },
    resolve("astro.config.mjs"),
    process.cwd(),
    undefined,
    undefined,
    "bundle",
  );
  if (!result) throw new Error("Smoke build configuration is missing");
  return result.config;
}

export async function buildFixture(build, loadConfig = loadFixtureConfig) {
  const envDir = mkdtempSync(join(tmpdir(), "gmd-smoke-env-"));
  try {
    // Astro and Vite both load env files through vite.envDir. The empty private
    // directory prevents the ordinary repository env files from being loaded.
    // Bypass Astro's config-loading Vite server, which otherwise loads root
    // env files before inline envDir takes effect. Bundling only reads config.
    const config = await loadConfig();
    await build({
      ...config,
      configFile: false,
      outDir: ".smoke-dist",
      vite: { ...config.vite, envDir },
    });
  } finally {
    rmSync(envDir, { recursive: true, force: true });
  }
}

export function isFixtureEntrypoint(entry) {
  return (
    Boolean(entry) && realpathSync(entry) === fileURLToPath(import.meta.url)
  );
}

// WHY: importing helpers in tests must not build the site. realpath also handles
// macOS /tmp aliases and other symlinked entry paths without silently skipping.
if (isFixtureEntrypoint(process.argv[1])) {
  if (process.argv[2] === "--worker") {
    const { build } = await import("astro");
    await buildFixture(build);
  } else {
    // WHY: config and Vite read environment during startup. A separate child
    // excludes credentials before imports, preventing them reaching artifacts.
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), "--worker"],
      {
        stdio: "inherit",
        env: fixtureEnvironment(process.env),
      },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}
