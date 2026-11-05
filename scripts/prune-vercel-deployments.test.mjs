import { describe, expect, it, vi } from "vitest";
import { pruneDeployments } from "./prune-vercel-deployments.mjs";

const projectId = "prj_9ByFOoPnfaBp2DKY30DcWI8TDeJq";
function fixture({ ready = true, domain = true, changes = false } = {}) {
  let projectReads = 0;
  const api = vi.fn(async (path, method) => {
    if (method === "DELETE") return {};
    if (path.startsWith("/v9/projects/")) {
      projectReads++;
      return {
        id: projectId,
        targets: {
          production: {
            id: changes && projectReads > 1 ? "dpl_new" : "dpl_current",
            readyState: ready ? "READY" : "BUILDING",
            createdAt: 100,
            alias: domain ? ["garammasaladating.com"] : [],
          },
        },
      };
    }
    if (path.startsWith("/v6/deployments"))
      return {
        deployments: [
          { uid: "dpl_current", state: "READY", created: 100 },
          { uid: "dpl_old", state: "READY", created: 50 },
          { uid: "dpl_building", state: "BUILDING", created: 90 },
          { uid: "dpl_newer", state: "READY", created: 110 },
          { uid: "dpl_failed", state: "ERROR", created: 110 },
          { uid: "dpl_custom", state: "READY", created: 50 },
        ],
        pagination: { next: null },
      };
    return {
      projectId,
      alias: path.endsWith("dpl_custom")
        ? ["special.example.com"]
        : ["old.vercel.app"],
    };
  });
  return api;
}

describe("deployment cleanup safeguards", () => {
  it("deletes only older terminal deployments without custom domains", async () => {
    const api = fixture();
    expect(await pruneDeployments(api, { apply: true, log: vi.fn() })).toBe(2);
    expect(api.mock.calls.filter(([, method]) => method === "DELETE")).toEqual([
      ["/v13/deployments/dpl_old", "DELETE"],
      ["/v13/deployments/dpl_failed", "DELETE"],
    ]);
  });
  it("defaults to a dry run", async () => {
    const api = fixture();
    await pruneDeployments(api, { log: vi.fn() });
    expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
      false,
    );
  });
  it.each([{ ready: false }, { domain: false }, { changes: true }])(
    "refuses unsafe production state %j",
    async (options) => {
      const api = fixture(options);
      await expect(
        pruneDeployments(api, { apply: true, log: vi.fn() }),
      ).rejects.toThrow();
      expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
        false,
      );
    },
  );
  it("fails if the API is unavailable", async () => {
    await expect(
      pruneDeployments(vi.fn().mockRejectedValue(new Error("offline"))),
    ).rejects.toThrow("offline");
  });
  it("refuses a deployment from a different project", async () => {
    const base = fixture();
    const api = vi.fn(async (path, method) =>
      path.startsWith("/v13/")
        ? { projectId: "another-project", alias: [] }
        : base(path, method),
    );
    await expect(
      pruneDeployments(api, { apply: true, log: vi.fn() }),
    ).rejects.toThrow("another project");
    expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
      false,
    );
  });
  it("reads later pages before selecting old deployments", async () => {
    const base = fixture();
    const api = vi.fn(async (path, method) => {
      if (path.startsWith("/v6/") && !path.includes("until="))
        return { deployments: [], pagination: { next: 75 } };
      return base(path, method);
    });
    expect(await pruneDeployments(api, { apply: true, log: vi.fn() })).toBe(2);
    expect(api.mock.calls.some(([path]) => path.includes("until=75"))).toBe(
      true,
    );
  });
  it("stops on a repeated page cursor without deleting anything", async () => {
    const base = fixture();
    const api = vi.fn(async (path, method) =>
      path.startsWith("/v6/")
        ? { deployments: [], pagination: { next: 75 } }
        : base(path, method),
    );
    await expect(
      pruneDeployments(api, { apply: true, log: vi.fn() }),
    ).rejects.toThrow("Repeated pagination cursor");
    expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
      false,
    );
  });
  it("reports deletion failures instead of claiming success", async () => {
    const base = fixture();
    const api = vi.fn(async (path, method) => {
      if (method === "DELETE") throw new Error("permission denied");
      return base(path, method);
    });
    await expect(
      pruneDeployments(api, { apply: true, log: vi.fn() }),
    ).rejects.toThrow("permission denied");
  });
});
