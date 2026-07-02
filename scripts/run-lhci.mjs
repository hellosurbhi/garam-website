import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const config = process.argv[2] ?? "lighthouserc.js";

function findPlaywrightChrome() {
  const cacheDir = join(homedir(), "Library", "Caches", "ms-playwright");
  if (!existsSync(cacheDir)) return null;

  const chromiumDirs = readdirSync(cacheDir)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse();

  for (const dir of chromiumDirs) {
    const macPath = join(
      cacheDir,
      dir,
      "chrome-mac-arm64",
      "Google Chrome for Testing.app",
      "Contents",
      "MacOS",
      "Google Chrome for Testing",
    );
    if (existsSync(macPath)) return macPath;

    const linuxPath = join(cacheDir, dir, "chrome-linux", "chrome");
    if (existsSync(linuxPath)) return linuxPath;
  }

  return null;
}

const env = { ...process.env };
if (!env.CHROME_PATH) {
  const chromePath = findPlaywrightChrome();
  if (chromePath) env.CHROME_PATH = chromePath;
}

const result = spawnSync(
  "lhci",
  ["autorun", `--config=${config}`, "--collect.staticDistDir=./dist/client"],
  {
    env,
    stdio: "inherit",
    shell: false,
  },
);

process.exit(result.status ?? 1);
