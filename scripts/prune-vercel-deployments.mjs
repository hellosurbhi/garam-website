import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const PROJECT_ID = "prj_9ByFOoPnfaBp2DKY30DcWI8TDeJq";
const TEAM_ID = "team_tn5J4k4lUV5PSlx7jxjjNu3r";
const TERMINAL_STATES = new Set(["READY", "ERROR", "CANCELED"]);

function gitPreview(deployment) {
  const { meta, target, source, customEnvironment, customEnvironmentId } =
    deployment;
  return (
    (target === null || target === "preview") &&
    source === "git" &&
    !customEnvironment &&
    !customEnvironmentId &&
    !deployment.isRollbackCandidate &&
    typeof meta?.githubCommitRef === "string" &&
    /^[a-f0-9]{40}$/i.test(meta.githubCommitSha ?? "")
  );
}

/**
 * replacedHeads(pullNumber) lists the heads a force-push replaced. GitHub's
 * /pulls/N/commits shows only the current series, so without it a preview
 * built for a rebased-away commit could never be proven merged and would
 * hold storage forever.
 */
export function mergedPreviewLookup(github, repository, replacedHeads) {
  const [owner, repo] = repository.split("/");
  const pullLists = new Map();
  const commits = new Map();
  const replacedCommits = new Map();
  const readAll = async (path) => {
    const entries = [];
    for (let page = 1; ; page++) {
      const batch = await github(
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      );
      assert.ok(
        Array.isArray(batch) && batch.length <= 100,
        "Invalid GitHub list",
      );
      entries.push(...batch);
      if (batch.length < 100) return entries;
    }
  };

  return async (deployment, { refresh = false } = {}) => {
    const { meta, created } = deployment;
    const { githubOrg, githubRepo, githubCommitRef, githubCommitSha } = meta;
    if (githubOrg !== owner || githubRepo !== repo) return false;

    if (refresh || !pullLists.has(githubCommitRef)) {
      const head = encodeURIComponent(`${owner}:${githubCommitRef}`);
      pullLists.set(
        githubCommitRef,
        await readAll(`/pulls?state=all&head=${head}`),
      );
    }
    const pulls = pullLists
      .get(githubCommitRef)
      .filter(
        (pull) =>
          pull.head?.repo?.full_name === repository &&
          pull.head.ref === githubCommitRef,
      );
    if (pulls.some((pull) => pull.state === "open")) return false;

    for (const pull of pulls) {
      if (
        pull.state !== "closed" ||
        !pull.merged_at ||
        !(created < Date.parse(pull.merged_at))
      )
        continue;
      if (pull.head.sha === githubCommitSha) return true;
      if (!commits.has(pull.number)) {
        assert.ok(
          Number.isSafeInteger(pull.number) && pull.number > 0,
          "Invalid pull request number",
        );
        commits.set(
          pull.number,
          new Set(
            (await readAll(`/pulls/${pull.number}/commits`)).map(
              (commit) => commit.sha,
            ),
          ),
        );
      }
      if (commits.get(pull.number).has(githubCommitSha)) return true;
      if (!replacedHeads) continue;
      if (!replacedCommits.has(pull.number)) {
        const shas = new Set();
        for (const head of await replacedHeads(pull.number)) {
          assert.ok(/^[a-f0-9]{40}$/i.test(head), "Invalid replaced head");
          // A null compare means the replaced series was garbage collected:
          // nothing proves the preview belonged to this PR, so it is kept.
          const compare = await github(`/compare/${pull.base.sha}...${head}`);
          for (const commit of compare?.commits ?? []) shas.add(commit.sha);
        }
        replacedCommits.set(pull.number, shas);
      }
      if (replacedCommits.get(pull.number).has(githubCommitSha)) return true;
    }
    return false;
  };
}

/** Prune obsolete production deployments and previews proven to belong to merged PRs. */
export async function pruneDeployments(
  api,
  {
    apply = false,
    log = console.log,
    canPrunePreview = async () => false,
  } = {},
) {
  const projectPath = `/v9/projects/${PROJECT_ID}`;
  /** Validate the project, ready production target and assigned domain before any deletion. */
  const readProduction = async () => {
    const project = await api(projectPath);
    assert.equal(project.id, PROJECT_ID, "Unexpected Vercel project");
    const current = project.targets?.production;
    assert.ok(
      current?.id && current.readyState === "READY",
      "No ready production target; refusing cleanup",
    );
    assert.ok(
      Array.isArray(current.alias) &&
        current.alias.some((alias) => alias === "garammasaladating.com"),
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

  // Keep one older successful production build available for rollback.
  const rollback = deployments
    .filter(
      (deployment) =>
        deployment.uid !== current.id &&
        deployment.target === "production" &&
        deployment.state === "READY" &&
        Number.isFinite(deployment.created) &&
        deployment.created < current.createdAt,
    )
    .sort((a, b) => b.created - a.created)[0];
  if (rollback) log(`Preserved rollback deployment ${rollback.uid}`);

  let removed = 0;
  for (const deployment of deployments) {
    if (
      deployment.uid === current.id ||
      deployment.uid === rollback?.uid ||
      !TERMINAL_STATES.has(deployment.state) ||
      !Number.isFinite(deployment.created)
    )
      continue;
    const production = deployment.target === "production";
    if (production) {
      if (
        deployment.state === "READY" &&
        deployment.created > current.createdAt
      )
        continue;
    } else if (
      !gitPreview(deployment) ||
      !(await canPrunePreview(deployment))
    ) {
      continue;
    }
    assert.match(deployment.uid, /^dpl_[a-zA-Z0-9]+$/);
    const detail = await api(`/v13/deployments/${deployment.uid}`);
    assert.equal(
      detail.projectId,
      PROJECT_ID,
      "Deployment belongs to another project",
    );
    if (production) {
      assert.equal(
        detail.target,
        "production",
        "Deployment is not confirmed as production; refusing cleanup",
      );
    } else if (
      detail.id !== deployment.uid ||
      !TERMINAL_STATES.has(detail.readyState) ||
      !gitPreview(detail) ||
      detail.meta.githubCommitRef !== deployment.meta.githubCommitRef ||
      detail.meta.githubCommitSha !== deployment.meta.githubCommitSha
    ) {
      continue;
    }
    assert.ok(
      Array.isArray(detail.alias),
      "Missing deployment aliases; refusing cleanup",
    );
    if (
      detail.alias.some((alias) => !alias.endsWith(".vercel.app")) ||
      (!production && detail.userAliases?.length)
    ) {
      log(`Preserved ${deployment.uid}: custom domain attached`);
      continue;
    }
    if (
      !production &&
      !(await canPrunePreview(
        { ...detail, created: deployment.created },
        { refresh: true },
      ))
    )
      continue;
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
    `Preserved production ${current.id}; ${apply ? "deleted" : "eligible"}: ${removed}. Deleted deployments stop contributing to storage usage immediately; dashboard totals can reflect earlier daily peaks.`,
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
    /** Call the team-scoped Vercel API with a bounded timeout and reject unsuccessful responses. */
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
    const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
    const githubHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    };
    // REST timeline events carry only the new head; GraphQL keeps the
    // replaced one (beforeCommit), which is what proves the old preview.
    const forcePushedHeads = async (number) => {
      const [owner, name] = GITHUB_REPOSITORY.split("/");
      const heads = [];
      for (let after = null; ;) {
        const response = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: githubHeaders,
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({
            query: `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){timelineItems(first:100,after:$after,itemTypes:[HEAD_REF_FORCE_PUSHED_EVENT]){pageInfo{hasNextPage endCursor} nodes{... on HeadRefForcePushedEvent{beforeCommit{oid}}}}}}}`,
            variables: { owner, name, number, after },
          }),
        });
        assert.ok(
          response.ok,
          `GitHub force-push lookup returned ${response.status}`,
        );
        const body = await response.json();
        const items = body?.data?.repository?.pullRequest?.timelineItems;
        assert.ok(items && !body.errors, "Invalid GitHub force-push lookup");
        for (const node of items.nodes) {
          if (node?.beforeCommit?.oid) heads.push(node.beforeCommit.oid);
        }
        if (!items.pageInfo.hasNextPage) return heads;
        assert.ok(items.pageInfo.endCursor !== after, "Repeated GitHub cursor");
        after = items.pageInfo.endCursor;
      }
    };
    const canPrunePreview =
      GITHUB_TOKEN && GITHUB_REPOSITORY
        ? mergedPreviewLookup(
            async (path) => {
              const response = await fetch(
                `https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`,
                { headers: githubHeaders, signal: AbortSignal.timeout(30_000) },
              );
              if (response.status === 404 && path.startsWith("/compare/"))
                return null;
              assert.ok(
                response.ok,
                `GitHub preview ownership lookup returned ${response.status}`,
              );
              return response.json();
            },
            GITHUB_REPOSITORY,
            (number) => forcePushedHeads(number),
          )
        : undefined;
    await pruneDeployments(api, {
      apply: process.argv.includes("--apply"),
      canPrunePreview,
    });
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Deployment cleanup failed",
    );
    process.exitCode = 1;
  }
}
