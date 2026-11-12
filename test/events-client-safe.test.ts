// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// WHY a source scan: src/data/events.ts is bundled into client islands, and a
// runtime import of ./eventsSnapshot (or zod itself) anywhere in its graph
// ships zod and every snapshot schema to the public apply page. Type imports
// are erased, so only value imports count. Bundle output would also catch it,
// but only after a full build that unit tests do not run.
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gms;

function runtimeGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith(".json")) continue;
    for (const [, spec] of readFileSync(file, "utf8").matchAll(VALUE_IMPORT)) {
      if (!spec.startsWith(".")) {
        seen.add(spec);
        continue;
      }
      const base = resolve(dirname(file), spec);
      queue.push(/\.(ts|json)$/.test(base) ? base : `${base}.ts`);
    }
  }
  return seen;
}

describe("events.ts client bundle graph", () => {
  it("never imports zod or the snapshot schemas at runtime", () => {
    const graph = [
      ...runtimeGraph(
        new URL("../src/data/events.ts", import.meta.url).pathname,
      ),
    ];
    expect(graph.some((f) => f.endsWith("/eventsSnapshot.ts"))).toBe(false);
    expect(graph).not.toContain("zod");
  });
});
