import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const workflow = readFileSync(
  ".github/workflows/prune-vercel-deployments.yml",
  "utf8",
);
const expression = workflow
  .match(/    if: >-\n([\s\S]*?)    runs-on:/)[1]
  .trim();
const eligible = (event_name, event = {}) =>
  runInNewContext(
    expression,
    { github: { event_name, event } },
    { timeout: 1000 },
  );
describe("deployment cleanup trigger", () => {
  it.each(["schedule", "workflow_dispatch"])("retains %s fallback", (name) =>
    expect(eligible(name)).toBe(true),
  );
  it.each([
    ["vercel[bot]", "Production", "success", true],
    ["vercel[bot]", "Preview", "success", false],
    ["vercel[bot]", "Production", "failure", false],
    ["other[bot]", "Production", "success", false],
  ])("filters %s %s %s", (login, environment, state, expected) => {
    expect(workflow).toContain("  deployment_status:");
    expect(
      eligible("deployment_status", {
        deployment: {
          creator: { login },
          environment,
          production_environment: false,
        },
        deployment_status: { state },
      }),
    ).toBe(expected);
  });
  it("retains only successful Vercel classic statuses", () => {
    expect(eligible("status", { context: "Vercel", state: "success" })).toBe(
      true,
    );
    expect(eligible("status", { context: "Vercel", state: "failure" })).toBe(
      false,
    );
    expect(eligible("status", { context: "unrelated", state: "success" })).toBe(
      false,
    );
  });
});
