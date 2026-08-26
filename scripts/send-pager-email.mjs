/**
 * Gmail pager for the synthetic apply monitor.
 *
 * Third alert channel alongside the GitHub issue and the site's own
 * /api/alert-failure email: sent by the workflow itself from the show's
 * Gmail, so it survives the exact failure mode of the July 2026 outage (the
 * site's email path being the broken thing) and arrives from a sender the
 * producer actually reads instead of GitHub's notification address.
 *
 * Modes:
 *   page: a monitor failure. Subject names the outage, body links the run.
 *   test: the weekly liveness drill and manual test_pager dispatches, so a
 *         drill is never mistaken for a real outage.
 *
 * WHY the Gmail REST API and not SMTP: v1 of this script used nodemailer
 * with an app password, but the credential that actually exists for
 * garammasaladating@gmail.com is the garam-email-outreach OAuth client,
 * whose refresh token is scoped to gmail.send only. SMTP XOAUTH2 requires
 * the full https://mail.google.com/ scope, so that token cannot log into
 * smtp.gmail.com at all; the REST send endpoint is the only transport it
 * supports. Plain fetch, because pulling in googleapis for one email is
 * unjustified. Rotating the credential means updating BOTH this repo's
 * secrets and garam-email-outreach.
 *
 * Env: GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 * (required, repo secrets), PAGER_EMAIL_TO (optional, defaults to the user
 * address), RUN_URL.
 */

// WHY 10s: Node's fetch has no default timeout; a stalled Google endpoint
// would eat the workflow job's time budget. 10s is generous for both calls
// and fails the step fast instead.
const FETCH_TIMEOUT_MS = 10_000;

function googleErrorMessage(body) {
  // The token endpoint returns flat {error, error_description}; the Gmail
  // API returns nested {error: {message}}. Handle both, never echo tokens.
  if (!body || typeof body !== "object") return "";
  if (typeof body.error === "string") {
    return [body.error, body.error_description].filter(Boolean).join(": ");
  }
  return body.error?.message ?? "";
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function sendPagerEmail(mode, env, fetchImpl) {
  if (mode !== "page" && mode !== "test") {
    throw new Error("usage: node scripts/send-pager-email.mjs <page|test>");
  }
  const user = env.GMAIL_USER?.trim();
  const clientId = env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = env.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = env.GMAIL_REFRESH_TOKEN?.trim();
  if (!user || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN secrets are not all set; the Gmail pager cannot send",
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

  const doFetch = fetchImpl ?? fetch;

  // Google's token endpoint accepts only form-encoded bodies, never JSON.
  const tokenResponse = await doFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const tokenBody = await readJsonSafe(tokenResponse);
  if (!tokenResponse.ok) {
    throw new Error(
      `Gmail token exchange failed (HTTP ${tokenResponse.status}): ${googleErrorMessage(tokenBody) || "no error detail"}`,
    );
  }
  const accessToken = tokenBody?.access_token;
  if (!accessToken) {
    throw new Error(
      "Gmail token exchange returned no access token; the pager cannot send",
    );
  }

  const message = [
    `From: "Garam Masala Dating pager" <${user}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    text,
  ].join("\r\n");
  const raw = Buffer.from(message, "utf8").toString("base64url");

  const sendResponse = await doFetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!sendResponse.ok) {
    const sendBody = await readJsonSafe(sendResponse);
    throw new Error(
      `Gmail send failed (HTTP ${sendResponse.status}): ${googleErrorMessage(sendBody) || "no error detail"}`,
    );
  }
  return { to, subject };
}

const isCli = process.argv[1]?.endsWith("send-pager-email.mjs");
if (isCli) {
  try {
    const { to, subject } = await sendPagerEmail(process.argv[2], process.env);
    console.log(`Pager email sent to ${to}: ${subject}`);
  } catch (err) {
    // WHY: only the error's own message is printed. The messages built above
    // embed HTTP statuses and Google's error text, never env values, so the
    // client secret and refresh token cannot leak into workflow logs.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
