import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const PROJECT_ID = "prj_9ByFOoPnfaBp2DKY30DcWI8TDeJq";
const TEAM_ID = "team_tn5J4k4lUV5PSlx7jxjjNu3r";
const TERMINAL_STATES = new Set(["READY", "ERROR", "CANCELED"]);

export async function pruneDeployments(
  api,
  { apply = false, log = console.log } = {},
) {
  const projectPath = `/v9/projects/${PROJECT_ID}`;
  const readProduction = async () => {
    const project = await api(projectPath);
    assert.equal(project.id, PROJECT_ID, "Unexpected Vercel project");
    const current = project.targets?.production;
    assert.ok(
      current?.id && current.readyState === "READY",
      "No ready production target; refusing cleanup",
    );
    assert.ok(
      current.alias?.includes("garammasaladating.com"),
      "Production domain is not assigned; refusing cleanup",
    );
    assert.ok(
      Number.isFinite(current.createdAt),
      "Missing production timestamp",
    );
    return current;
  };
  const current = await readProduction();
  const deployments = [];
  const cursors = new Set();
  let until;
  do {
    const query = new URLSearchParams({ projectId: PROJECT_ID, limit: "100" });
    if (until !== undefined) query.set("until", String(until));
    const page = await api(`/v6/deployments?${query}`);
    assert.ok(Array.isArray(page.deployments), "Invalid deployment list");
    deployments.push(...page.deployments);
    until = page.pagination?.next;
    if (until != null) {
      assert.ok(!cursors.has(until), "Repeated pagination cursor");
      cursors.add(until);
    }
  } while (until != null);

  let removed = 0;
  for (const deployment of deployments) {
    if (
      deployment.uid === current.id ||
      !TERMINAL_STATES.has(deployment.state) ||
      !Number.isFinite(deployment.created) ||
      deployment.created > current.createdAt
    )
      continue;
    assert.match(deployment.uid, /^dpl_[a-zA-Z0-9]+$/);
    const detail = await api(`/v13/deployments/${deployment.uid}`);
    assert.equal(
      detail.projectId,
      PROJECT_ID,
      "Deployment belongs to another project",
    );
    if (detail.alias?.some((alias) => !alias.endsWith(".vercel.app"))) {
      log(`Preserved ${deployment.uid}: custom domain attached`);
      continue;
    }
    const latest = await readProduction();
    assert.equal(
      latest.id,
      current.id,
      "Production changed during cleanup; retry on the next run",
    );
    if (apply) await api(`/v13/deployments/${deployment.uid}`, "DELETE");
    log(`${apply ? "Deleted" : "Would delete"} ${deployment.uid}`);
    removed++;
  }
  log(
    `Preserved production ${current.id}; ${apply ? "deleted" : "eligible"}: ${removed}. Storage reclamation follows Vercel's recovery period.`,
  );
  return removed;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const token = process.env.VERCEL_TOKEN;
    assert.ok(
      token,
      "Configure the VERCEL_TOKEN repository Actions secret before running cleanup",
    );
    const api = async (path, method = "GET") => {
      const url = new URL(path, "https://api.vercel.com");
      url.searchParams.set("teamId", TEAM_ID);
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      assert.ok(
        response.ok,
        `Vercel ${method} ${url.pathname} returned ${response.status}`,
      );
      return response.status === 204 ? {} : response.json();
    };
    await pruneDeployments(api, { apply: process.argv.includes("--apply") });
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Deployment cleanup failed",
    );
    process.exitCode = 1;
  }
}
