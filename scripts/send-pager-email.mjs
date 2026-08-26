import nodemailer from "nodemailer";

/**
 * Gmail pager for the synthetic apply monitor.
 *
 * Third alert channel alongside the GitHub issue and the site's own
 * /api/alert-failure email: sent by the workflow itself through Gmail's SMTP,
 * so it survives the exact failure mode of the July 2026 outage (the site's
 * email path being the broken thing) and arrives from a sender the producer
 * actually reads instead of GitHub's notification address.
 *
 * Modes:
 *   page: a monitor failure. Subject names the outage, body links the run.
 *   test: the weekly liveness drill and manual test_pager dispatches, so a
 *         drill is never mistaken for a real outage.
 *
 * Env: GMAIL_PAGER_USER + GMAIL_PAGER_APP_PASSWORD (required, repo secrets),
 * PAGER_EMAIL_TO (optional, defaults to the user address), RUN_URL.
 */
export async function sendPagerEmail(mode, env, transportFactory) {
  if (mode !== "page" && mode !== "test") {
    throw new Error("usage: node scripts/send-pager-email.mjs <page|test>");
  }
  const user = env.GMAIL_PAGER_USER?.trim();
  const pass = env.GMAIL_PAGER_APP_PASSWORD?.trim();
  if (!user || !pass) {
    throw new Error(
      "GMAIL_PAGER_USER and GMAIL_PAGER_APP_PASSWORD secrets are not set; the Gmail pager cannot send",
    );
  }
  const to = env.PAGER_EMAIL_TO?.trim() || user;
  const runUrl = env.RUN_URL?.trim() ?? "";

  const subject =
    mode === "page"
      ? "APPLY MONITOR FAILED: production form likely broken"
      : "Weekly pager test: the Gmail alert channel works. No action needed.";
  const text =
    mode === "page"
      ? [
          "The synthetic apply monitor FAILED. The production apply form is likely rejecting real applicants right now.",
          "",
          `Workflow run with the diagnosis: ${runUrl || "(run URL unavailable)"}`,
          "",
          "The verify and rules-drift step outputs in that run show the cause and the applicant impact.",
        ].join("\n")
      : [
          "This is the scheduled proof that the Gmail pager channel still works end to end.",
          "",
          runUrl
            ? `Sent by workflow run: ${runUrl}`
            : "Sent by a manual test run.",
        ].join("\n");

  // WHY: nodemailer's defaults wait 2 minutes to connect and 10 minutes on a
  // stalled socket; a wedged SMTP session would eat the workflow job's time
  // budget. 10s is generous for Gmail and fails the step fast instead.
  const factory = transportFactory ?? nodemailer.createTransport;
  const transport = factory({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
  await transport.sendMail({
    from: `"Garam Masala Dating pager" <${user}>`,
    to,
    subject,
    text,
  });
  return { to, subject };
}

const isCli = process.argv[1]?.endsWith("send-pager-email.mjs");
if (isCli) {
  try {
    const { to, subject } = await sendPagerEmail(process.argv[2], process.env);
    console.log(`Pager email sent to ${to}: ${subject}`);
  } catch (err) {
    // WHY: only the error's own message is printed. Transport errors from
    // nodemailer never embed the password, and our validation errors are
    // static strings, so the app password cannot leak into workflow logs.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
