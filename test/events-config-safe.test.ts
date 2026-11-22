// @vitest-environment node
import { describe, it, expect } from "vitest";
import { runnerImport } from "vite";

// WHY a separate loader: vitest applies the "@/" alias, so a normal import
// cannot catch an alias creeping into this graph. astro.config.mjs loads
// src/data/events.ts through Vite's runnerImport WITHOUT the alias; doing
// the same here with no config file fails this test on any "@/" import
// reachable from events.ts, which would otherwise only break `astro build`.
describe("events.ts import graph (plan R20)", () => {
  it("loads without the @/ alias, like astro.config.mjs does", async () => {
    const { module } = await runnerImport<typeof import("../src/data/events")>(
      new URL("../src/data/events.ts", import.meta.url).pathname,
      { configFile: false },
    );
    expect(module.events.length).toBeGreaterThan(0);
  }, 30_000);
});
