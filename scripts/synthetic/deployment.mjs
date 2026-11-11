import { setTimeout as sleep } from "node:timers/promises";
export const PRODUCTION = "https://garammasaladating.com";
export async function deployedCommit(fetchImpl = fetch) {
  const res = await fetchImpl(`${PRODUCTION}/api/version`, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok)
    throw new Error(`Deployment version unavailable (${res.status})`);
  const { commit } = await res.json();
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error("Deployment version is invalid");
  return commit;
}
export async function requireVersion(expected, fetchImpl = fetch) {
  if (!/^[a-f0-9]{40}$/.test(expected ?? ""))
    throw new Error("Expected deployment commit is missing");
  if ((await deployedCommit(fetchImpl)) !== expected)
    throw new Error("Deployment version differs from the tested revision");
}
if (process.argv[1]?.endsWith("synthetic/deployment.mjs")) {
  const deadline =
    Date.now() +
    (process.env.MONITOR_WAIT_FOR_DEPLOY === "true" ? 28 * 60_000 : 0);
  for (;;) {
    try {
      await requireVersion(process.env.GITHUB_SHA);
      break;
    } catch (error) {
      if (Date.now() >= deadline) {
        console.error(error.message);
        process.exitCode = 1;
        break;
      }
      await sleep(15_000);
    }
  }
}
