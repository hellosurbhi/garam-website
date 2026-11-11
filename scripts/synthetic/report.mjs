import { sendPagerEmail } from "../send-pager-email.mjs";
import { PRODUCTION } from "./deployment.mjs";

export function categories(gate, checks) {
  if (gate === "cancelled") return [];
  if (gate !== "success") return ["deployment"];
  const result = [];
  if (checks.cleanup === "failure") result.push("cleanup");
  if (checks.version === "failure") result.push("deployment");
  if (checks.setup !== "success") result.push("harness");
  else if (checks.rules !== "success") result.push("deployment");
  else if (checks.flow !== "success" && checks.version !== "failure")
    result.push("flow");
  if (checks.redirects === "failure") result.push("redirects");
  return [...new Set(result)];
}
export async function ping(url, failed, fetchImpl = fetch) {
  if (!url) throw new Error("External watchdog is not configured");
  const parsed = new URL(url);
  if (
    parsed.origin !== "https://hc-ping.com" ||
    !/^\/[a-f0-9-]{36}$/.test(parsed.pathname) ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Invalid watchdog endpoint");
  const response = await fetchImpl(`${url}${failed ? "/fail" : ""}`, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || (await response.text()).trim() !== "OK")
    throw new Error("Watchdog did not accept the heartbeat");
}
export async function siteAlert(category, message, env, fetchImpl = fetch) {
  const response = await fetchImpl(`${PRODUCTION}/api/alert-failure`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json", Origin: PRODUCTION },
    body: JSON.stringify({
      flow: "ops",
      stage: `monitor_${category}`,
      errorMessage: message,
      pageUrl: `${PRODUCTION}/monitor/${category}`,
    }),
  });
  if (!response.ok) throw new Error(`Site alert failed (${response.status})`);
  const body = await response.json();
  if (body.ok !== true || body.suppressed)
    throw new Error("Site alert was not freshly accepted");
}
const descriptions = {
  deployment:
    "The live version or database rules do not match this check. Production testing could not confirm the release.",
  harness:
    "The testing system could not run reliably. Customer impact is unknown.",
  flow: "A live signup check did not complete. Check the run for form errors or rate limiting before concluding customers are blocked.",
  cleanup:
    "Test data cleanup needs attention. Test identities remain excluded from customer counts and marketing.",
  redirects: "A live ticket redirect did not match the expected destination.",
  notification:
    "A monitoring notification channel or external watchdog failed verification.",
};
export async function report(env = process.env, fetchImpl = fetch) {
  const checks = JSON.parse(env.CHECK_OUTCOMES || "{}");
  const active = categories(env.GATE_RESULT, checks);
  if (env.GATE_RESULT === "cancelled") return;
  let notificationFailed = false;
  const weekly =
    env.EVENT_NAME === "schedule" &&
    env.SCHEDULE === "30 13 * * 1" &&
    env.RUN_ATTEMPT === "1";
  const drill = weekly || env.TEST_PAGER === "true";
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  async function github(path, method = "GET", body) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? ""))
      throw new Error("Invalid repository");
    const res = await fetchImpl(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`,
      {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      },
    );
    if (!res.ok) throw new Error(`Incident tracking failed (${res.status})`);
    return res.json();
  }
  const issues = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const batch = await github(`issues?state=open&per_page=100&page=${page}`);
      issues.push(...batch.filter((issue) => !issue.pull_request));
      if (batch.length < 100) break;
      if (page === 10)
        throw new Error("Incident listing exceeded its safe page limit");
    }
  } catch {
    notificationFailed = true;
  }
  async function email(category, recovery = false) {
    const message = recovery
      ? `Two consecutive checks passed. The ${category} incident has recovered.`
      : descriptions[category];
    let gmail = false;
    let site = false;
    try {
      await sendPagerEmail(
        "page",
        {
          ...env,
          MONITOR_MESSAGE: message,
          MONITOR_SUBJECT: `Website monitor: ${category}${recovery ? " recovered" : " needs attention"}`,
        },
        fetchImpl,
      );
      gmail = true;
    } catch {
      notificationFailed = true;
    }
    // Site fallback is independent of the Gmail credential and the issue tracker.
    if (!gmail || drill) {
      try {
        await siteAlert(category, message, env, fetchImpl);
        site = true;
      } catch {
        notificationFailed = true;
      }
    }
    return gmail || site;
  }
  async function incident(category, failing) {
    const title = `[Monitor] ${category}`;
    const existing = issues.find((issue) => issue.title === title);
    let state = { clean: 0, run: "", accepted: false };
    if (existing) {
      try {
        state = JSON.parse(
          existing.body.match(/<!-- monitor-state:(.*?) -->/)?.[1] ?? "{}",
        );
      } catch {
        notificationFailed = true;
      }
    }
    if (!failing && !existing) return;
    if (state.run === env.GITHUB_RUN_ID) return;
    if (
      /^\d+$/.test(state.run ?? "") &&
      /^\d+$/.test(env.GITHUB_RUN_ID ?? "") &&
      BigInt(state.run) > BigInt(env.GITHUB_RUN_ID)
    )
      return;
    const escalate =
      category === "cleanup" && checks.cleanupEscalated && !state.escalated;
    const accepted =
      failing && (!existing || !state.accepted || escalate)
        ? await email(category)
        : Boolean(state.accepted);
    const clean = failing ? 0 : (Number(state.clean) || 0) + 1;
    const marker = `<!-- monitor-state:${JSON.stringify({ clean, run: env.GITHUB_RUN_ID, accepted, escalated: Boolean(state.escalated || escalate) })} -->`;
    const body = `${descriptions[category]}\n\nRun: ${env.RUN_URL}\n\n${marker}`;
    if (existing) {
      if (clean >= 2 && accepted) await email(category, true);
      await github(`issues/${existing.number}`, "PATCH", {
        body,
        ...(clean >= 2 ? { state: "closed" } : {}),
      });
    } else
      await github("issues", "POST", {
        title,
        body,
        assignees: ["hellosurbhi"],
      });
  }
  for (const category of Object.keys(descriptions).filter(
    (key) => key !== "notification",
  )) {
    try {
      const healthy =
        env.GATE_RESULT === "success" &&
        (category === "cleanup"
          ? checks.cleanup === "success"
          : category === "harness"
            ? checks.setup === "success"
            : category === "deployment"
              ? checks.rules === "success" && checks.version === "success"
              : category === "redirects"
                ? checks.redirects === "success" && checks.version === "success"
                : checks.flow === "success" &&
                  checks.rules === "success" &&
                  checks.version === "success");
      if (active.includes(category) || healthy)
        await incident(category, active.includes(category));
    } catch {
      notificationFailed = true;
    }
  }
  const repairingNotifications = issues.some(
    (issue) => issue.title === "[Monitor] notification",
  );
  if (drill || repairingNotifications) {
    let gmail = false;
    let site = false;
    try {
      await sendPagerEmail("test", env, fetchImpl);
      gmail = true;
    } catch {
      notificationFailed = true;
    }
    try {
      await siteAlert(
        "heartbeat",
        "Labelled monitoring notification test. Receipt must be checked separately.",
        env,
        fetchImpl,
      );
      site = true;
    } catch {
      notificationFailed = true;
    }
    if (weekly && gmail && site) {
      try {
        await ping(env.WEEKLY_WATCHDOG_URL, false, fetchImpl);
      } catch {
        notificationFailed = true;
      }
    }
  }
  if (!env.WATCHDOG_URL || !env.WEEKLY_WATCHDOG_URL) notificationFailed = true;
  if (env.EVENT_NAME === "schedule") {
    try {
      await ping(
        env.WATCHDOG_URL,
        notificationFailed || active.includes("harness"),
        fetchImpl,
      );
    } catch {
      notificationFailed = true;
    }
  }
  try {
    await incident("notification", notificationFailed);
  } catch {
    notificationFailed = true;
  }
  if (notificationFailed)
    throw new Error(
      "Notification verification incomplete; inspect the incident and external watchdog",
    );
}
if (process.argv[1]?.endsWith("synthetic/report.mjs")) {
  try {
    await report();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Monitor reporting failed",
    );
    process.exitCode = 1;
  }
}
