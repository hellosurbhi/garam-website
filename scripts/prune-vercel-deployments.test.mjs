import { describe, expect, it, vi } from "vitest";
import {
  mergedPreviewLookup,
  pruneDeployments,
} from "./prune-vercel-deployments.mjs";

const projectId = "prj_9ByFOoPnfaBp2DKY30DcWI8TDeJq";
const repository = "hellosurbhi/garam-website";
const preview = {
  uid: "dpl_mergedPreview",
  state: "READY",
  target: null,
  source: "git",
  created: 95,
  meta: {
    githubOrg: "hellosurbhi",
    githubRepo: "garam-website",
    githubCommitRef: "fix/example",
    githubCommitSha: "a".repeat(40),
  },
};
const mergedPull = {
  number: 12,
  state: "closed",
  merged_at: new Date(100).toISOString(),
  head: {
    repo: { full_name: repository },
    ref: "fix/example",
    sha: "b".repeat(40),
  },
};
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
          { uid: "dpl_old", state: "READY", created: 50, target: "production" },
          {
            uid: "dpl_rollback",
            state: "READY",
            created: 80,
            target: "production",
          },
          {
            uid: "dpl_building",
            state: "BUILDING",
            created: 90,
            target: "production",
          },
          {
            uid: "dpl_newer",
            state: "READY",
            created: 110,
            target: "production",
          },
          {
            uid: "dpl_failed",
            state: "ERROR",
            created: 110,
            target: "production",
          },
          {
            uid: "dpl_custom",
            state: "READY",
            created: 50,
            target: "production",
          },
        ],
        pagination: { next: null },
      };
    return {
      projectId,
      target: "production",
      alias: path.endsWith("dpl_custom")
        ? ["special.example.com"]
        : ["old.vercel.app"],
    };
  });
  return api;
}

describe("deployment cleanup safeguards", () => {
  it("deletes the proven merged preview even when production has not changed", async () => {
    const base = fixture();
    const api = vi.fn(async (path, method) => {
      if (method !== "DELETE" && path.endsWith(preview.uid)) {
        return {
          ...preview,
          id: preview.uid,
          projectId,
          readyState: "READY",
          alias: [],
        };
      }
      const result = await base(path, method);
      if (path.startsWith("/v6/")) result.deployments.push(preview);
      return result;
    });
    const github = vi.fn(async (path) =>
      path.startsWith("/pulls?")
        ? [mergedPull]
        : [{ sha: preview.meta.githubCommitSha }],
    );
    await pruneDeployments(api, {
      apply: true,
      log: vi.fn(),
      canPrunePreview: mergedPreviewLookup(github, repository),
    });
    expect(api.mock.calls).toContainEqual([
      `/v13/deployments/${preview.uid}`,
      "DELETE",
    ]);
    expect(
      github.mock.calls.filter(([path]) => path.startsWith("/pulls?")),
    ).toHaveLength(2);
  });

  it.each([
    ["open PR", [mergedPull, { ...mergedPull, state: "open" }], preview],
    ["closed without merge", [{ ...mergedPull, merged_at: null }], preview],
    ["new deployment after merge", [mergedPull], { ...preview, created: 101 }],
    [
      "fork metadata",
      [mergedPull],
      { ...preview, meta: { ...preview.meta, githubOrg: "fork" } },
    ],
    ["unrelated commit", [mergedPull], preview],
  ])("preserves previews with %s", async (_case, pulls, candidate) => {
    const github = vi.fn(async (path) =>
      path.startsWith("/pulls?") ? pulls : [],
    );
    expect(await mergedPreviewLookup(github, repository)(candidate)).toBe(
      false,
    );
  });

  it.each([
    ["the replaced head", "c"],
    ["an earlier commit of the replaced series", "a"],
  ])(
    "deletes a merged PR's preview of %s after a force-push",
    async (_case, letter) => {
      const sha = letter.repeat(40);
      const replaced = "c".repeat(40);
      const pull = { ...mergedPull, base: { sha: "d".repeat(40) } };
      const github = vi.fn(async (path) => {
        if (path.startsWith("/pulls?")) return [pull];
        if (path.startsWith("/pulls/12/commits")) return [];
        if (path === `/compare/${pull.base.sha}...${replaced}`)
          return { commits: [{ sha: "a".repeat(40) }, { sha: replaced }] };
        throw new Error(`unexpected ${path}`);
      });
      const replacedHeads = vi.fn(async () => [replaced]);
      const candidate = {
        ...preview,
        meta: { ...preview.meta, githubCommitSha: sha },
      };
      expect(
        await mergedPreviewLookup(github, repository, replacedHeads)(candidate),
      ).toBe(true);
      expect(replacedHeads).toHaveBeenCalledWith(12);
    },
  );

  it.each([
    ["no force-push", [], null],
    ["a replaced series that no longer exists", ["c".repeat(40)], null],
    [
      "a replaced series without the commit",
      ["c".repeat(40)],
      { commits: [{ sha: "c".repeat(40) }] },
    ],
  ])(
    "preserves a merged PR's preview after %s",
    async (_case, heads, compare) => {
      const pull = { ...mergedPull, base: { sha: "d".repeat(40) } };
      const github = vi.fn(async (path) => {
        if (path.startsWith("/pulls?")) return [pull];
        if (path.startsWith("/pulls/12/commits")) return [];
        if (path.startsWith("/compare/")) return compare;
        throw new Error(`unexpected ${path}`);
      });
      expect(
        await mergedPreviewLookup(
          github,
          repository,
          async () => heads,
        )(preview),
      ).toBe(false);
    },
  );

  it("keeps a preview if its branch is reused by an open PR before deletion", async () => {
    const base = fixture();
    const api = vi.fn(async (path, method) => {
      if (method !== "DELETE" && path.endsWith(preview.uid)) {
        return {
          ...preview,
          id: preview.uid,
          projectId,
          readyState: "READY",
          alias: [],
        };
      }
      const result = await base(path, method);
      if (path.startsWith("/v6/")) result.deployments.push(preview);
      return result;
    });
    const canPrunePreview = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await pruneDeployments(api, { apply: true, log: vi.fn(), canPrunePreview });
    expect(api.mock.calls).not.toContainEqual([
      `/v13/deployments/${preview.uid}`,
      "DELETE",
    ]);
  });
  it("deletes only obsolete terminal production deployments without custom domains", async () => {
    const api = fixture();
    expect(await pruneDeployments(api, { apply: true, log: vi.fn() })).toBe(2);
    expect(api.mock.calls.filter(([, method]) => method === "DELETE")).toEqual([
      ["/v13/deployments/dpl_old", "DELETE"],
      ["/v13/deployments/dpl_failed", "DELETE"],
    ]);
  });
  it("keeps previews when a newer production deployment goes live", async () => {
    const base = fixture();
    const api = vi.fn(async (path, method) => {
      const result = await base(path, method);
      if (path.startsWith("/v6/"))
        result.deployments.push(
          {
            uid: "dpl_preview",
            state: "READY",
            created: 95,
            target: "preview",
          },
          {
            uid: "dpl_preview_error",
            state: "ERROR",
            created: 99,
            target: "preview",
          },
          {
            uid: "dpl_failedprod",
            state: "ERROR",
            created: 99,
            target: "production",
          },
        );
      return result;
    });
    await pruneDeployments(api, { apply: true, log: vi.fn() });
    const deleted = api.mock.calls
      .filter(([, method]) => method === "DELETE")
      .map(([path]) => path);
    expect(deleted).not.toContain("/v13/deployments/dpl_rollback");
    expect(deleted).toContain("/v13/deployments/dpl_old");
    expect(deleted).not.toContain("/v13/deployments/dpl_preview");
    expect(deleted).not.toContain("/v13/deployments/dpl_preview_error");
    expect(deleted).toContain("/v13/deployments/dpl_failedprod");
  });
  it("defaults to a dry run", async () => {
    const api = fixture();
    await pruneDeployments(api, { log: vi.fn() });
    expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
      false,
    );
  });
  it.each([
    [{ ready: false }, "No ready production target"],
    [{ domain: false }, "Production domain"],
    [{ changes: true }, "Production changed during cleanup"],
  ])("refuses unsafe production state %j", async (options, message) => {
    const api = fixture(options);
    await expect(
      pruneDeployments(api, { apply: true, log: vi.fn() }),
    ).rejects.toThrow(message);
    expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
      false,
    );
  });
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
  it.each(["preview", null, undefined])(
    "refuses a candidate whose details report target %s",
    async (target) => {
      const base = fixture();
      const api = vi.fn(async (path, method) =>
        path.startsWith("/v13/")
          ? { projectId, target, alias: [] }
          : base(path, method),
      );
      await expect(
        pruneDeployments(api, { apply: true, log: vi.fn() }),
      ).rejects.toThrow("Deployment is not confirmed as production");
      expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
        false,
      );
    },
  );
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
  it.each([
    "https://garammasaladating.com.attacker.test",
    ["garammasaladating.com.attacker.test"],
  ])("rejects non-exact production aliases %j", async (alias) => {
    const base = fixture();
    const api = vi.fn(async (path, method) => {
      const value = await base(path, method);
      if (path.startsWith("/v9/")) value.targets.production.alias = alias;
      return value;
    });
    await expect(
      pruneDeployments(api, { apply: true, log: vi.fn() }),
    ).rejects.toThrow("Production domain");
    expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(
      false,
    );
  });
});
