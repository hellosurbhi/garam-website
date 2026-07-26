/**
 * send-waitlist-gmail-v1.mjs
 * Personalized one to one plain text sends via the Gmail API.
 *
 * Usage (env comes from .env.local via the npm scripts):
 *   npm run waitlist:auth                     (once, to mint a refresh token)
 *   npm run waitlist:dry
 *   npm run waitlist:test -- you@yourmail.com
 *   npm run waitlist:send
 *   npm run waitlist:send -- --limit 100      (optional lower cap for a partial run)
 *
 * Env (.env.local):
 *   GMAIL_CLIENT_ID=
 *   GMAIL_CLIENT_SECRET=
 *   GMAIL_REFRESH_TOKEN=
 *   GMAIL_USER=garammasaladating@gmail.com
 *   FROM_NAME=Wyatt
 */

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { parse } from "csv-parse/sync";

// WHY: paths are anchored to this script's directory, not process.cwd() —
// the npm scripts run from the repo root, so cwd-relative paths would look
// for the CSV in the wrong place and silently create a stray sent log there.
const HERE = import.meta.dirname;
const LIST_FILE = path.join(HERE, "waitlist-v1.csv");
const SENT_LOG = path.join(HERE, "sent-log-gmail-v1.json");

const MIN_DELAY_MS = 45_000;
const MAX_DELAY_MS = 95_000;
// WHY: free Gmail hard-caps around 500 recipients per rolling 24h; exceeding
// it can suspend outbound mail on the account for 24-72h. 450 leaves margin
// for replies and manual mail Surbhi sends the same day. Raise only with
// --limit after checking how many the account already sent that day.
const DEFAULT_SEND_LIMIT = 450;

const SHOW = {
  // WHY: campaign is the sent-log dedup key and MUST be unique per campaign.
  // It was previously derived from city + "this Sunday", which collides with
  // the next show announced the same way and silently skips every recipient.
  campaign: "nyc-2026-07-26",
  link: "https://tickets.citywinery.com/event/garam-masala-comedy-dating-show-all-stars-editio-ownqgw",
  code: "SURBHI",
};

const args = process.argv.slice(2);
const isSend = args.includes("--send");
const testIdx = args.indexOf("--test");
const testTo = testIdx > -1 ? args[testIdx + 1] : null;
const limitIdx = args.indexOf("--limit");
const sendLimit =
  limitIdx > -1 ? Number.parseInt(args[limitIdx + 1], 10) : DEFAULT_SEND_LIMIT;

if (!Number.isInteger(sendLimit) || sendLimit < 1) {
  console.error("--limit must be a positive integer");
  process.exit(1);
}

const REQUIRED_ENV = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_USER",
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `Missing env vars: ${missing.join(", ")}\n` +
      "Add them to .env.local (block to paste is in scripts/waitlist/README.md), then rerun.\n" +
      "GMAIL_REFRESH_TOKEN comes from: npm run waitlist:auth",
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "http://localhost:3000/oauth2callback",
);
oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oauth2 });

function subjectFor() {
  return "Surbhi does not know I am sending this (Garam Masala Dating)";
}

function bodyFor(firstName) {
  const hi = firstName ? `Hi ${firstName}!` : "Hi!";
  return `${hi}

This is Wyatt from Garam Masala Dating. You have been to one of our shows before, and I am about to ask you for a favor.

It is Surbhi's birthday and I am quietly trying to sell out the room as a surprise for her. She has no idea I am sending this. We are doing a special birthday episode at our new venue, City Winery, and it would mean everything to her to walk out and see a packed house.

This one is an all star show too. We are bringing back fan favorites and we have a few surprises lined up that I am not allowed to say anything about yet!

Tickets are here: ${SHOW.link}

Use code ${SHOW.code} for 20 percent off. The show is Sunday at 7, so grab your seat before they are gone.

If you are not in New York anymore, just reply and tell me where you moved and I will put you on that city's list so you only hear from us when we actually come to you.

And if you would rather not get emails from us at all, reply to this one and I will make sure we never contact you again. No hard feelings at all!

Thank you for supporting live comedy. It genuinely matters right now, and it matters most to Surbhi. Would love to see you there!

Wyatt
Garam Masala Dating`;
}

function loadRecipients() {
  if (!fs.existsSync(LIST_FILE)) {
    console.error(
      `Recipient list not found: ${LIST_FILE}\n` +
        "It is gitignored on purpose (real emails never get committed). " +
        "Copy waitlist-v1.example.csv to waitlist-v1.csv and fill it in, " +
        "or regenerate it from the master audience workbook.",
    );
    process.exit(1);
  }
  const raw = fs.readFileSync(LIST_FILE, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true })
    .filter((r) => r.email && r.email.includes("@"))
    .filter((r) => String(r.unsubscribed || "").toLowerCase() !== "true");
}

const loadSent = () =>
  fs.existsSync(SENT_LOG) ? JSON.parse(fs.readFileSync(SENT_LOG, "utf8")) : {};
const saveSent = (log) =>
  fs.writeFileSync(SENT_LOG, JSON.stringify(log, null, 2));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () =>
  Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

async function buildRaw(to, firstName) {
  const mail = new MailComposer({
    from: `"${process.env.FROM_NAME || "Wyatt"}" <${process.env.GMAIL_USER}>`,
    to,
    replyTo: process.env.GMAIL_USER,
    subject: subjectFor(),
    text: bodyFor(firstName),
  });
  const message = await mail.compile().build();
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendOne(to, firstName) {
  const raw = await buildRaw(to, firstName);
  return gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

async function main() {
  if (testTo) {
    if (!testTo.includes("@")) {
      console.error("Usage: npm run waitlist:test -- you@yourmail.com");
      process.exit(1);
    }
    await sendOne(testTo, "Wyatt");
    console.log(`Test sent to ${testTo}. Check which Gmail tab it landed in.`);
    return;
  }

  const recipients = loadRecipients();
  const sent = loadSent();
  const unsent = recipients.filter((r) => !sent[`${SHOW.campaign}:${r.email}`]);
  const queue = unsent.slice(0, sendLimit);

  console.log(
    `${recipients.length} on list, ${unsent.length} not yet sent, ` +
      `${queue.length} in this run (limit ${sendLimit}).`,
  );
  console.log(`Campaign: ${SHOW.campaign}`);
  console.log(
    `From: "${process.env.FROM_NAME || "Wyatt"}" <${process.env.GMAIL_USER}>`,
  );
  console.log(`Subject: ${subjectFor()}`);
  console.log("---");
  console.log(bodyFor(queue[0]?.first_name || ""));
  console.log("---");

  if (!isSend) {
    console.log("Dry run. Nothing sent. Rerun with --send.");
    return;
  }

  for (const [i, r] of queue.entries()) {
    try {
      await sendOne(r.email, r.first_name);
      sent[`${SHOW.campaign}:${r.email}`] = new Date().toISOString();
      saveSent(sent);
      console.log(`[${i + 1}/${queue.length}] sent ${r.email}`);
    } catch (err) {
      console.error(
        `[${i + 1}/${queue.length}] FAILED ${r.email}`,
        err.message,
      );
    }
    if (i < queue.length - 1) {
      const wait = jitter();
      console.log(`waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  if (unsent.length > queue.length) {
    console.log(
      `Stopped at the ${sendLimit} send limit. ${unsent.length - queue.length} remain; ` +
        "rerun after the 24h window to continue (already-sent people are skipped).",
    );
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
