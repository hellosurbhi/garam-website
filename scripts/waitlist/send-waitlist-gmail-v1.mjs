/**
 * send-waitlist-gmail-v1.mjs
 * Personalized one to one plain text sends via the Gmail API.
 *
 * Usage (env comes from .env.waitlist.local via the npm scripts):
 *   npm run waitlist:auth                     (once, to mint a refresh token)
 *   npm run waitlist:dry
 *   npm run waitlist:test -- you@yourmail.com
 *   npm run waitlist:send
 *   npm run waitlist:send -- --limit 100      (optional lower cap for a partial run)
 *
 * Env (.env.waitlist.local):
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

// WHY: 4-7s gaps, not the original 45-95s — Surbhi's deadline is that every
// email lands before midnight ET the night before the show. ~6/min is still
// far below burst limits; the 500/day cap is the binding constraint.
const MIN_DELAY_MS = 4_000;
const MAX_DELAY_MS = 7_000;
// WHY: free Gmail hard-caps around 500 recipients per rolling 24h; exceeding
// it can suspend outbound mail on the account for 24-72h. 450 leaves margin
// for replies and manual mail Surbhi sends the same day. Raise only with
// --limit after checking how many the account already sent that day.
const DEFAULT_SEND_LIMIT = 450;

// WHY: hardcoded, not env-driven — the sender display name is campaign copy
// and must not silently vary with whatever an old env file says.
const FROM_NAME = "Wyatt Feegrado, Garam Masala Dating";

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

// --until HH:MM (local time, today): hard-stop before the next send once
// the deadline passes. Whoever is left simply does not get sent.
const untilIdx = args.indexOf("--until");
let deadlineMs = null;
if (untilIdx > -1) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(args[untilIdx + 1] || "");
  if (!m) {
    console.error("--until expects HH:MM (24h local), e.g. --until 23:58");
    process.exit(1);
  }
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  deadlineMs = d.getTime();
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
      "Add them to .env.waitlist.local (block to paste is in scripts/waitlist/README.md), then rerun.\n" +
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

Thank you so much for being a fan of the show.

It's my cohost Surbhi's birthday tomorrow and I'm quietly trying to sell out the room as a surprise for her. She has no idea I'm doing this. We're doing a birthday episode at our new venue, City Winery and it would mean everything to her to walk out and see a packed house.

It's an all star show too. We're bringing back fan favorites and there are a few surprises lined up that I'm not allowed to talk about yet!

Doors at 6pm tomorrow, Sunday July 26th, City Winery at 25 11th Ave, New York.

Tickets are here: ${SHOW.link}

As a thank you for being a continued supporter, here's code ${SHOW.code} for 20 percent off.

We would love to see you there. It would mean a lot to me and it would mean the most to her!

If you're not in New York anymore, reply and tell me where you moved and I'll put you on that city's list so you only hear from us when we actually come to you.

And if you'd rather not get emails from us at all, just reply to this one and I'll make sure we never contact you again. No hard feelings at all!

Wyatt Feegrado
Garam Masala Dating`;
}

// WHY: the Gmail API re-encodes outgoing text/plain and hard-wraps it at
// ~76 chars regardless of our transfer encoding, which renders as jagged
// mid-sentence breaks in Gmail. Real Gmail-composed mail is always
// multipart/alternative with a simple HTML part, so we mirror that: same
// words, <br> for newlines, zero styling/images/tracking. Do not remove
// the html part or the wrapping comes back.
function htmlFor(firstName) {
  const escaped = bodyFor(firstName)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
  return `<div dir="ltr">${linked.replace(/\n/g, "<br>")}</div>`;
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
  // WHY: suppressed.csv is the permanent per-address kill list (manual
  // removals, service addresses, Surbhi's own address). It is enforced here,
  // at the last gate before sending, so a regenerated waitlist CSV that
  // accidentally re-includes someone still never emails them.
  const suppressed = new Set();
  const supFile = path.join(HERE, "suppressed.csv");
  if (fs.existsSync(supFile)) {
    for (const row of parse(fs.readFileSync(supFile, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })) {
      if (row.email) suppressed.add(row.email.toLowerCase());
    }
  }
  const raw = fs.readFileSync(LIST_FILE, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true })
    .filter((r) => r.email && r.email.includes("@"))
    .filter((r) => String(r.unsubscribed || "").toLowerCase() !== "true")
    .filter((r) => !suppressed.has(r.email.toLowerCase()));
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
    from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
    to,
    replyTo: process.env.GMAIL_USER,
    subject: subjectFor(),
    text: bodyFor(firstName),
    html: htmlFor(firstName),
    textEncoding: "base64",
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
    // Optional second arg after the address personalizes the test greeting:
    // npm run waitlist:test -- someone@x.com Mikaela
    await sendOne(testTo, args[testIdx + 2] || "");
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
  console.log(`From: "${FROM_NAME}" <${process.env.GMAIL_USER}>`);
  console.log(`Subject: ${subjectFor()}`);
  console.log("---");
  console.log(bodyFor(queue[0]?.first_name || ""));
  console.log("---");

  if (!isSend) {
    console.log("Dry run. Nothing sent. Rerun with --send.");
    return;
  }

  for (const [i, r] of queue.entries()) {
    if (deadlineMs && Date.now() >= deadlineMs) {
      console.log(
        `Deadline reached; stopping. ${queue.length - i} of this run unsent.`,
      );
      break;
    }
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
