export const prerender = false;
import type { APIRoute } from "astro";
import { alertOps } from "@/lib/opsAlert";
import { store } from "@/lib/outreach/store";
import { configuredAccounts, connectMailbox } from "@/lib/outreach/gmail";
import { runWorker } from "@/lib/outreach/worker";
import { unsubscribeToken } from "@/lib/outreach/unsubscribe";
import { refreshContacts } from "@/lib/outreach/contacts";
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Preview deployments must never consume the production queue.
  if (
    import.meta.env.VERCEL_ENV !== "production" ||
    import.meta.env.OUTREACH_ONLINE !== "1"
  )
    return Response.json({ paused: true });
  const now = Date.now();
  try {
    await refreshContacts(now);
    const accounts = configuredAccounts();
    const connections = await Promise.allSettled(accounts.map(connectMailbox));
    const mailboxes = connections.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const failedAccounts = connections.flatMap((result, i) =>
      result.status === "rejected" ? [accounts[i].address] : [],
    );
    if (accounts.length && !mailboxes.length)
      throw new Error("Gmail connections need attention");
    const result = await runWorker(
      store,
      mailboxes,
      Date.now(),
      (email) =>
        `https://garammasaladating.com/api/email-unsubscribe?token=${unsubscribeToken(email)}`,
      Date.now,
    );
    const health = await store.get("emailSystem/worker");
    await store.put(
      "emailSystem/worker",
      {
        checkedAt: now,
        ...result,
        connectedAccounts: mailboxes.map((a) => a.address),
        failedAccounts,
      },
      health?.version ?? null,
    );
    return Response.json(result);
  } catch (error) {
    console.error(
      "Email worker failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    try {
      const key = "emailSystem/failure";
      const previous = await store.get<{ reportedAt: number }>(key);
      if (
        (!previous || now - previous.value.reportedAt > 3600000) &&
        (await store.put(key, { reportedAt: now }, previous?.version ?? null))
      ) {
        await alertOps({
          flow: "ops",
          stage: "show_email",
          errorMessage:
            "The automatic show email sender needs attention. Open Show emails in the admin dashboard.",
        });
      }
    } catch (reportError) {
      console.error(
        "Email failure reporting failed",
        reportError instanceof Error ? reportError.message : "Unknown error",
      );
    }
    return Response.json(
      { error: "Email worker needs attention" },
      { status: 500 },
    );
  }
};
