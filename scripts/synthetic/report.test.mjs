// @vitest-environment node
import { it, expect, vi } from "vitest";
import { categories, ping, siteAlert } from "./report.mjs";
import { requireVersion } from "./deployment.mjs";
it("separates broken testing, deployment changes and cleanup from form failures", () => {
  expect(categories("failure", {})).toEqual(["deployment"]);
  expect(categories("cancelled", {})).toEqual([]);
  expect(categories("success", {})).toEqual(["harness"]);
  expect(
    categories("success", {
      setup: "success",
      rules: "success",
      flow: "failure",
      version: "failure",
      cleanup: "failure",
    }),
  ).toEqual(["cleanup", "deployment"]);
});
it("refuses stale production before any submission", async () => {
  await expect(
    requireVersion(
      "a".repeat(40),
      async () => new Response(JSON.stringify({ commit: "b".repeat(40) })),
    ),
  ).rejects.toThrow("differs");
});
it("requires watchdog configuration and an actual accepted ping body", async () => {
  await expect(ping(undefined, false)).rejects.toThrow("not configured");
  await expect(
    ping(
      "https://hc-ping.com/01234567-89ab-4cde-8fab-0123456789ab",
      false,
      async () => new Response("not found"),
    ),
  ).rejects.toThrow("did not accept");
});
it("signals a failed watchdog through its failure endpoint", async () => {
  const fetcher = vi.fn(async () => new Response("OK"));
  await ping(
    "https://hc-ping.com/01234567-89ab-4cde-8fab-0123456789ab",
    true,
    fetcher,
  );
  expect(fetcher.mock.calls[0][0]).toMatch(/\/fail$/);
});
it("never treats a suppressed or undelivered site alert as fresh delivery", async () => {
  for (const response of [
    new Response("{}", { status: 503 }),
    new Response('{"ok":true,"suppressed":true}'),
    new Response('{"ok":false}'),
  ])
    await expect(
      siteAlert("test", "message", {}, async () => response),
    ).rejects.toThrow();
});

import { report } from "./report.mjs";
function reportFixture() {
  const calls = [];
  const env = {
    GATE_RESULT: "success",
    CHECK_OUTCOMES: JSON.stringify({
      setup: "success",
      rules: "success",
      flow: "success",
      redirects: "success",
      cleanup: "success",
      version: "success",
    }),
    GITHUB_REPOSITORY: "owner/repo",
    GITHUB_RUN_ID: "123",
    EVENT_NAME: "schedule",
    SCHEDULE: "30 1,7,19 * * *",
    RUN_ATTEMPT: "1",
    WATCHDOG_URL: "https://hc-ping.com/01234567-89ab-4cde-8fab-0123456789ab",
    WEEKLY_WATCHDOG_URL:
      "https://hc-ping.com/11234567-89ab-4cde-8fab-0123456789ab",
    GMAIL_USER: "fixture@example.com",
    GMAIL_CLIENT_ID: "fixture",
    GMAIL_CLIENT_SECRET: "fixture",
    GMAIL_REFRESH_TOKEN: "fixture",
    RUN_URL: "https://github.com/owner/repo/actions/runs/123",
  };
  const fetcher = vi.fn(async (url, init) => {
    calls.push({ url, init });
    if (url.includes("issues?")) return new Response("[]");
    if (new URL(url).hostname === "api.github.com")
      return new Response('{"number":1}');
    if (url.includes("oauth2"))
      return new Response('{"access_token":"fixture"}');
    if (new URL(url).hostname === "gmail.googleapis.com")
      return new Response('{"id":"message"}');
    if (url.includes("alert-failure")) return new Response('{"ok":true}');
    if (url.includes("hc-ping")) return new Response("OK");
    throw new Error("Unexpected external request in isolated test");
  });
  return { calls, env, fetcher };
}
it("does not notify on an ordinary successful run", async () => {
  const { env, fetcher, calls } = reportFixture();
  await report(env, fetcher);
  expect(
    calls.some((c) => new URL(c.url).hostname === "gmail.googleapis.com"),
  ).toBe(false);
  expect(calls.filter((c) => c.url.includes("hc-ping"))).toHaveLength(1);
});
it("weekly heartbeat uses the scheduled slot even if execution is delayed", async () => {
  const { env, fetcher, calls } = reportFixture();
  env.SCHEDULE = "30 13 * * 1";
  await report(env, fetcher);
  expect(
    calls.filter((c) => new URL(c.url).hostname === "gmail.googleapis.com"),
  ).toHaveLength(1);
  expect(calls.filter((c) => c.url.includes("hc-ping"))).toHaveLength(2);
});
it("a failed Gmail channel invokes the independent site fallback and creates a notification incident", async () => {
  const { env, fetcher, calls } = reportFixture();
  env.CHECK_OUTCOMES = env.CHECK_OUTCOMES.replace(
    '"flow":"success"',
    '"flow":"failure"',
  );
  const failing = async (url, init) =>
    url.includes("oauth2")
      ? new Response("{}", { status: 401 })
      : fetcher(url, init);
  await expect(report(env, failing)).rejects.toThrow(
    "Notification verification incomplete",
  );
  expect(calls.some((c) => c.url.includes("alert-failure"))).toBe(true);
  expect(
    calls.some((c) => c.init?.body?.includes("[Monitor] notification")),
  ).toBe(true);
  expect(calls.some((c) => c.url.endsWith("/fail"))).toBe(true);
});
it("a missing external watchdog does not raise a notification incident or fail the run", async () => {
  const { env, fetcher, calls } = reportFixture();
  delete env.WATCHDOG_URL;
  delete env.WEEKLY_WATCHDOG_URL;
  await report(env, fetcher);
  expect(calls.some((c) => c.url.includes("hc-ping"))).toBe(false);
  expect(
    calls.some((c) => c.init?.body?.includes("[Monitor] notification")),
  ).toBe(false);
});
it("the weekly notification drill succeeds without watchdog secrets and pings nothing", async () => {
  const { env, fetcher, calls } = reportFixture();
  delete env.WATCHDOG_URL;
  delete env.WEEKLY_WATCHDOG_URL;
  env.SCHEDULE = "30 13 * * 1";
  await report(env, fetcher);
  expect(
    calls.filter((c) => new URL(c.url).hostname === "gmail.googleapis.com"),
  ).toHaveLength(1);
  expect(calls.some((c) => c.url.includes("hc-ping"))).toBe(false);
});
it("a real failure still emails and opens an incident without a watchdog", async () => {
  const { env, fetcher, calls } = reportFixture();
  delete env.WATCHDOG_URL;
  delete env.WEEKLY_WATCHDOG_URL;
  env.CHECK_OUTCOMES = env.CHECK_OUTCOMES.replace(
    '"flow":"success"',
    '"flow":"failure"',
  );
  await report(env, fetcher);
  expect(
    calls.some((c) => new URL(c.url).hostname === "gmail.googleapis.com"),
  ).toBe(true);
  expect(calls.some((c) => c.init?.body?.includes("[Monitor] flow"))).toBe(
    true,
  );
});
it("a configured watchdog that rejects the ping still fails the run", async () => {
  const { env, fetcher } = reportFixture();
  const rejecting = async (url, init) =>
    url.includes("hc-ping") ? new Response("nope") : fetcher(url, init);
  await expect(report(env, rejecting)).rejects.toThrow(
    "Notification verification incomplete",
  );
});
it("does not close a form incident when deployment gating skipped the form", async () => {
  const { env, fetcher, calls } = reportFixture();
  env.GATE_RESULT = "failure";
  const withIssue = async (url, init) =>
    url.includes("issues?")
      ? new Response(
          JSON.stringify([
            {
              number: 99,
              title: "[Monitor] flow",
              body: '<!-- monitor-state:{"clean":1,"run":"122","accepted":true} -->',
            },
          ]),
        )
      : fetcher(url, init);
  await report(env, withIssue);
  expect(calls.some((c) => c.url.endsWith("issues/99"))).toBe(false);
});
it("does not page or ping for a superseded or canceled queued check", async () => {
  for (const change of [
    { CHECK_RESULT: "cancelled" },
    { GATE_STATE: "superseded" },
  ]) {
    const { env, fetcher } = reportFixture();
    await report({ ...env, ...change }, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  }
});
import { decideGate, desiredMain } from "./deployment.mjs";
it("tests ready, building, timeout, superseded and non-main gate decisions", () => {
  const input = {
    sha: "new",
    main: "new",
    deployed: "new",
    expired: false,
    ref: "refs/heads/main",
  };
  expect(decideGate(input)).toBe("ready");
  expect(decideGate({ ...input, deployed: "old" })).toBe("wait");
  expect(decideGate({ ...input, deployed: "old", expired: true })).toBe(
    "timeout",
  );
  expect(decideGate({ ...input, main: "newer" })).toBe("superseded");
  expect(decideGate({ ...input, ref: "refs/heads/feature" })).toBe(
    "invalid-ref",
  );
});
it("validates the desired main revision response", async () => {
  const env = { GITHUB_REPOSITORY: "owner/repo", GITHUB_TOKEN: "fixture" };
  expect(
    await desiredMain(
      env,
      async () => new Response(JSON.stringify({ sha: "a".repeat(40) })),
    ),
  ).toBe("a".repeat(40));
  await expect(
    desiredMain(env, async () => new Response("{}")),
  ).rejects.toThrow("invalid");
});
it("does not hide cleanup failure when the deployed commit changes mid-run", () => {
  expect(
    categories("success", {
      versionState: "superseded",
      flow: "failure",
      cleanup: "failure",
    }),
  ).toEqual(["cleanup"]);
  expect(
    categories("success", {
      preversionState: "superseded",
      cleanup: "success",
    }),
  ).toEqual([]);
});
