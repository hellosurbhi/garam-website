/**
 * send-waitlist-gmail-v1.mjs
 * Personalized one to one plain text sends via the Gmail API.
 *
 * Usage (env comes from .env.waitlist.local via the npm scripts; every
 * recipient list must first pass sender/build_queue.py — see CLAUDE.md):
 *   npm run auth                          (once, to mint a refresh token)
 *   npm run send-dry
 *   npm run send-test -- you@yourmail.com
 *   npm run send
 *   npm run send -- --limit 100           (optional lower cap for a partial run)
 * WHY the scripts are named send-*: the bash guardrails gate asks Surbhi for
 * approval on any npm script whose name contains "send"; a script literally
 * named "test" collided with the universal `npm test` and would either
 * bypass the gate or force it to nag on every repo's tests (Codex audit #1).
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
import crypto from "node:crypto";

// WHY: paths are anchored to this script's directory, not process.cwd() —
// the npm scripts run from the repo root, so cwd-relative paths would look
// for the CSV in the wrong place and silently create a stray sent log there.
const HERE = import.meta.dirname;

// WHY 150-240s: human-correspondence pacing for the Gmail path. The one time
// gaps were compressed to seconds to hit a deadline (2026-07-25, Zoho), the
// provider read it as a compromised account and blocked outbound mail.
// CLAUDE.md rule 5: never compress the gap to hit a deadline — report the
// real ETA instead. ESP transports (Brevo/Resend) override to 55-95s below.
const MIN_DELAY_MS = 150_000;
const MAX_DELAY_MS = 240_000;
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
  // WHY eventDate: the body says "today"/"tonight" — relative copy that goes
  // FALSE the morning after the show. --send refuses once the event is past
  // so a stale campaign can never be fired again by accident (Codex review
  // 2026-07-28, HIGH-1). Update this with every new campaign.
  eventDate: "2026-07-26",
  // The gate stamps region into the manifest; the sender only accepts queues
  // built under the matching region policy (HIGH-2).
  expectedRegion: "nyc",
};
const EXPECTED_GATE_VERSION = 3;

const args = process.argv.slice(2);
const isSend = args.includes("--send");
const noHtml = args.includes("--no-html");
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
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    // JS Date would silently normalize 25:00 into tomorrow (Codex MEDIUM-1).
    console.error("--until expects HH:MM (24h local, 00:00-23:59), e.g. --until 23:58");
    process.exit(1);
  }
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  deadlineMs = d.getTime();
}

// WHY there is NO zoho transport: batch/automated sending via Zoho Mail
// violates their acceptable-use policy and got contact@ blocked on
// 2026-07-25 (CLAUDE.md rule 3). The transport was removed 2026-07-28 so the
// banned channel cannot be selected even by accident. Valid: gmail (default),
// brevo, resend.
const via = args.includes("--via") ? args[args.indexOf("--via") + 1] : "gmail";
const viaBrevo = via === "brevo";
const viaResend = via === "resend";
if (!["gmail", "brevo", "resend"].includes(via)) {
  console.error(
    `Unknown transport "--via ${via}". Valid: gmail, brevo, resend. ` +
      "(zoho was removed deliberately — Zoho bans batch sending and blocked the account for it.)",
  );
  process.exit(1);
}
const listIdx = args.indexOf("--list");
const listArg = listIdx > -1 ? args[listIdx + 1] : "waitlist-v1.csv";
const LIST_FILE = path.isAbsolute(listArg) ? listArg : path.join(HERE, listArg);
// WHY: per-transport sent logs. Queues are built disjoint per channel, and
// separate logs mean two concurrent channel runs never race on one JSON file.
const logIdx = args.indexOf("--log");
const logArg = logIdx > -1 ? args[logIdx + 1] : null;
const SENT_LOG = path.join(
  HERE,
  logArg
    ? logArg
    : viaBrevo
      ? "sent-log-brevo-v1.json"
      : viaResend
        ? "sent-log-resend-v1.json"
        : "sent-log-gmail-v1.json",
);
// Brevo is an ESP built for batch (300/day free); mailbox providers get the
// extra-slow drip. Both respect the 45s floor rule.
const MIN_DELAY = viaBrevo || viaResend ? 55_000 : MIN_DELAY_MS;
const MAX_DELAY = viaBrevo || viaResend ? 95_000 : MAX_DELAY_MS;

const REQUIRED_ENV = viaResend
  ? ["RESEND_API_KEY"]
  : viaBrevo
    ? ["BREVO_SMTP_LOGIN", "BREVO_SMTP_PASS"]
    : [
      "GMAIL_CLIENT_ID",
      "GMAIL_CLIENT_SECRET",
      "GMAIL_REFRESH_TOKEN",
      "GMAIL_USER",
    ];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `Missing env vars: ${missing.join(", ")}\n` +
      "Add them to .env.waitlist.local, then rerun.\n" +
      "GMAIL_REFRESH_TOKEN comes from: npm run auth",
  );
  process.exit(1);
}

const SENDER_ADDRESS = viaBrevo || viaResend
  ? "contact@garammasaladating.com"
  : process.env.GMAIL_USER;
const REPLY_TO = viaBrevo || viaResend ? "garammasaladating@gmail.com" : SENDER_ADDRESS;

let gmail = null;
let smtp = null;
if (viaBrevo) {
  const nodemailer = (await import("nodemailer")).default;
  smtp = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_LOGIN,
      pass: process.env.BREVO_SMTP_PASS,
    },
  });
} else {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "http://localhost:3000/oauth2callback",
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  gmail = google.gmail({ version: "v1", auth: oauth2 });
}

function subjectFor() {
  return "Surbhi does not know I am sending this (Garam Masala Dating)";
}

function bodyFor(firstName) {
  const hi = firstName ? `Hi ${firstName}!` : "Hi!";
  return `${hi}

Thank you so much for being a fan of the show.

It's my cohost Surbhi's birthday today and I'm quietly trying to sell out the room as a surprise for her. She has no idea I'm doing this. We're doing a birthday episode at our new venue, City Winery and it would mean everything to her to walk out and see a packed house.

It's an all star show too. We're bringing back fan favorites and there are a few surprises lined up that I'm not allowed to talk about yet!

Doors at 6pm tonight, Sunday July 26th, City Winery at 25 11th Ave, New York.

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

// WHY: suppressed.csv is the permanent per-address kill list (manual
// removals, service addresses, Surbhi's own address). REQUIRED — a missing
// kill list must stop the run, never silently disable last-mile suppression
// (Codex audit 2026-07-28, #14).
function loadSuppressed() {
  // GATE_TEST_ROOT redirects to fixture data for test_build_queue.py ONLY —
  // mirrors build_queue.py; production runs must never set it.
  const supFile = process.env.GATE_TEST_ROOT
    ? path.join(process.env.GATE_TEST_ROOT, "sender", "suppressed.csv")
    : path.join(HERE, "suppressed.csv");
  if (!fs.existsSync(supFile)) {
    console.error(
      `suppressed.csv missing at ${supFile} — the permanent kill list is required, always. Refusing to run.`,
    );
    process.exit(1);
  }
  const suppressed = new Set();
  for (const row of parse(fs.readFileSync(supFile, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })) {
    if (row.email) suppressed.add(row.email.toLowerCase());
  }
  return suppressed;
}

function loadRecipients() {
  // WHY: every list must come out of build_queue.py, which runs ALL
  // validation (junk, typos, suppression, dedup, region, cross-channel
  // sent-logs) and publishes a manifest binding sha256 + campaign + output
  // name. The sender refuses anything else, which is what makes sending
  // around the gate impossible. The manifest (vs the old bare .sig) blocks
  // three bypasses found in the 2026-07-28 Codex audit: replaying an old
  // campaign's CSV+sig pair (#3/#5), renaming a signed file (#3), and the
  // read-verify/read-parse race — the SAME bytes are hashed and parsed (#3).
  let stat;
  try {
    stat = fs.lstatSync(LIST_FILE);
  } catch {
    console.error(`Recipient list not found: ${LIST_FILE}`);
    process.exit(1);
  }
  if (stat.isSymbolicLink()) {
    console.error(`REFUSED: ${LIST_FILE} is a symlink. The gate signs real files only.`);
    process.exit(1);
  }
  const manifestFile = LIST_FILE + ".manifest.json";
  if (!fs.existsSync(manifestFile)) {
    console.error(
      `UNGATED LIST: ${LIST_FILE} has no .manifest.json.\n` +
        "Run: ../.venv/bin/python build_queue.py <input.csv> " + LIST_FILE +
        ` --campaign ${SHOW.campaign}`,
    );
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const rawBuf = fs.readFileSync(LIST_FILE);
  const digest = crypto.createHash("sha256").update(rawBuf).digest("hex");
  if (digest !== manifest.sha256) {
    console.error(
      `STALE MANIFEST: ${LIST_FILE} was modified after gating.\n` +
        "Re-run build_queue.py — hand edits must go through the gate too.",
    );
    process.exit(1);
  }
  if (manifest.campaign !== SHOW.campaign) {
    console.error(
      `CAMPAIGN MISMATCH: list was gated for "${manifest.campaign}" but this sender is campaign "${SHOW.campaign}".\n` +
        "Rebuild the queue with --campaign " + SHOW.campaign + " — a mismatched queue skips the wrong sent-log entries.",
    );
    process.exit(1);
  }
  if (manifest.output !== path.basename(LIST_FILE)) {
    console.error(
      `RENAMED LIST: manifest was issued for "${manifest.output}", not "${path.basename(LIST_FILE)}". Rebuild the queue.`,
    );
    process.exit(1);
  }
  if (manifest.gate_version !== EXPECTED_GATE_VERSION) {
    console.error(
      `OUTDATED GATE: queue was built by gate v${manifest.gate_version}, this sender requires v${EXPECTED_GATE_VERSION}. ` +
        "Rebuild with the current build_queue.py — older gates lack checks this sender depends on.",
    );
    process.exit(1);
  }
  if (manifest.region !== SHOW.expectedRegion) {
    console.error(
      `REGION MISMATCH: queue was gated with region "${manifest.region}" but this campaign requires "${SHOW.expectedRegion}". ` +
        "A region=any queue must never ride an NYC campaign. Rebuild.",
    );
    process.exit(1);
  }
  const suppressed = loadSuppressed();
  // Parse the exact bytes that were hash-verified — never a second read.
  return parse(rawBuf.toString("utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
    .filter((r) => r.email && r.email.includes("@"))
    .filter((r) => String(r.unsubscribed || "").toLowerCase() !== "true")
    .filter((r) => !suppressed.has(r.email.toLowerCase()));
}

const loadSent = () =>
  fs.existsSync(SENT_LOG) ? JSON.parse(fs.readFileSync(SENT_LOG, "utf8")) : {};
// WHY atomic (tmp + rename): a partial write of the sent log after a crash
// loses dedup state for emails that WERE delivered — the resend bug class
// (Codex review 2026-07-28, CRITICAL-1). rename on the same filesystem is
// atomic; a crash leaves either the old complete log or the new complete log.
const saveSent = (log) => {
  const tmp = SENT_LOG + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(log, null, 2));
  fs.renameSync(tmp, SENT_LOG);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () =>
  Math.floor(MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY));

function mailOptions(to, firstName) {
  return {
    from: `"${FROM_NAME}" <${SENDER_ADDRESS}>`,
    to,
    replyTo: REPLY_TO,
    subject: subjectFor(),
    text: bodyFor(firstName),
    ...(noHtml ? {} : { html: htmlFor(firstName) }),
    textEncoding: "base64",
  };
}

async function sendOne(to, firstName) {
  if (viaResend) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${SENDER_ADDRESS}>`,
        to: [to],
        reply_to: REPLY_TO,
        subject: subjectFor(),
        text: bodyFor(firstName),
        ...(noHtml ? {} : { html: htmlFor(firstName) }),
      }),
    });
    if (!res.ok) {
      throw new Error(`resend ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
  if (smtp) {
    return smtp.sendMail(mailOptions(to, firstName));
  }
  const message = await new MailComposer(mailOptions(to, firstName))
    .compile()
    .build();
  const raw = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

// WHY: test sends bypass the queue+manifest path by design (one explicit
// address), but they must NOT bypass address validation or suppression —
// a test to a suppressed or junk address is still a real outbound email
// (Codex audit 2026-07-28, #12). Regexes mirror build_queue.py; keep in sync.
const TEST_EMAIL_RE = /^(?!\.)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+(?<!\.)@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const TEST_JUNK_RE = /^(test|testing|fake|asdf+|abc+|example|sample|dummy|noreply|no-reply|donotreply)\d*@|@(test|example|sample|fake)\.(com|con|net|org|co)$/i;
const TEST_TYPO_RE = /(gamail|gmial|gnail|gmal|gmaill|gmali|yahooo|hotmial|outlok|iclould)\.|\.(con|cmo|comm|ocm|vom)$/i;
const TEST_ROLE_RE = /^(info|contact|support|admin|sales|team|office|events?|tickets?|booking|press|marketing|billing|newsletter|service|guestlist|help|jobs|careers|hr|hello|mail|enquiries|inquiries|boxoffice)([._+-].*)?@/i;

// WHY a process lock: two concurrent runs load the same sent log, pick the
// same recipients, and double-send before either records anything (Codex
// review 2026-07-28, CRITICAL-2). 'wx' creation is atomic; a stale lock from
// a dead process is stolen by pid liveness check.
const LOCK_FILE = path.join(HERE, ".sender.lock");
function acquireLock() {
  for (;;) {
    try {
      fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
      process.on("exit", () => {
        try {
          if (fs.readFileSync(LOCK_FILE, "utf8") === String(process.pid)) fs.unlinkSync(LOCK_FILE);
        } catch {}
      });
      return;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      let holder = NaN;
      try {
        holder = Number(fs.readFileSync(LOCK_FILE, "utf8"));
      } catch {}
      let alive = false;
      if (Number.isInteger(holder) && holder > 0) {
        try {
          process.kill(holder, 0);
          alive = true;
        } catch {}
      }
      if (alive) {
        console.error(`REFUSED: another sender run (pid ${holder}) holds ${LOCK_FILE}. One run at a time, always.`);
        process.exit(1);
      }
      try {
        fs.unlinkSync(LOCK_FILE); // stale lock from a dead process
      } catch {}
    }
  }
}

async function main() {
  if (process.env.GATE_TEST_ROOT) {
    // Fixture mode must be unmissable AND incapable of a real campaign send
    // (Codex review 2026-07-28, HIGH-3).
    console.error(`*** SENDER TEST MODE: fixture data root = ${process.env.GATE_TEST_ROOT} ***`);
    if (isSend) {
      console.error("REFUSED: --send is disabled under GATE_TEST_ROOT. Unset it for real runs.");
      process.exit(1);
    }
  }
  acquireLock();
  if (testTo) {
    if (isSend) {
      console.error("--test and --send are mutually exclusive. Pick one mode.");
      process.exit(1);
    }
    const t = testTo.trim().toLowerCase();
    if (!TEST_EMAIL_RE.test(t) || t.includes("..")) {
      console.error(`REFUSED: "${testTo}" is not a valid address. Usage: npm run waitlist:send-test -- you@yourmail.com`);
      process.exit(1);
    }
    if (TEST_JUNK_RE.test(t) || TEST_TYPO_RE.test(t)) {
      console.error(`REFUSED: "${testTo}" matches a junk/typo pattern — this would bounce or hit a fake mailbox.`);
      process.exit(1);
    }
    if (TEST_ROLE_RE.test(t) && !/@(.*\.)?garammasaladating\.com$/.test(t)) {
      console.error(`REFUSED: "${testTo}" is a role/service address, not a person (mirrors the queue gate).`);
      process.exit(1);
    }
    if (loadSuppressed().has(t)) {
      console.error(
        `REFUSED: ${t} is in suppressed.csv (bounced/unsubscribed/team). ` +
          "If this test is intentional, remove the line from suppressed.csv first — deliberately, by hand.",
      );
      process.exit(1);
    }
    // Optional second arg after the address personalizes the test greeting:
    // npm run waitlist:send-test -- someone@x.com Mikaela
    await sendOne(testTo, args[testIdx + 2] || "");
    console.log(`Test sent to ${testTo}. Check which Gmail tab it landed in.`);
    return;
  }

  const recipients = loadRecipients();
  const sent = loadSent();
  const unsent = recipients.filter((r) => !sent[`${SHOW.campaign}:${r.email}`]);

  // WHY rolling-24h accounting: provider caps are per rolling day, not per
  // invocation — an immediate rerun with a fresh 450 allowance is exactly how
  // an account gets frozen (Codex review 2026-07-28, HIGH-4). Counted from
  // THIS transport's sent log; Brevo's free tier is 300/day so its ceiling is
  // lower than the Gmail default.
  const transportCap = viaBrevo ? 280 : DEFAULT_SEND_LIMIT;
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const sentLast24h = Object.values(sent).filter(
    (ts) => new Date(ts).getTime() > dayAgo,
  ).length;
  const remainingToday = Math.max(0, transportCap - sentLast24h);
  const effectiveLimit = Math.min(sendLimit, remainingToday);
  if (isSend && effectiveLimit === 0) {
    console.error(
      `REFUSED: ${sentLast24h} sends in the last 24h on this transport (cap ${transportCap}). ` +
        "Wait for the rolling window to free up.",
    );
    process.exit(1);
  }
  const queue = unsent.slice(0, effectiveLimit);

  console.log(
    `${recipients.length} on list, ${unsent.length} not yet sent, ` +
      `${queue.length} in this run (limit ${effectiveLimit}: ` +
      `min of --limit ${sendLimit} and ${remainingToday} left in this transport's rolling 24h cap of ${transportCap}).`,
  );
  console.log(`Campaign: ${SHOW.campaign}`);
  console.log(`From: "${FROM_NAME}" <${SENDER_ADDRESS}>`);
  console.log(`Subject: ${subjectFor()}`);
  console.log("---");
  console.log(bodyFor(queue[0]?.first_name || ""));
  console.log("---");

  if (!isSend) {
    console.log("Dry run. Nothing sent. Rerun with --send.");
    return;
  }

  // WHY the stale-campaign guard sits on --send only: dry runs are previews.
  // The body copy is relative ("today", "tonight") and goes false the morning
  // after the show — firing a past campaign is always a mistake (HIGH-1).
  if (new Date(`${SHOW.eventDate}T23:59:59`) < new Date()) {
    console.error(
      `REFUSED: campaign ${SHOW.campaign} is over (event date ${SHOW.eventDate} has passed). ` +
        "Update the SHOW block (campaign, eventDate, copy) for the next show.",
    );
    process.exit(1);
  }

  for (const [i, r] of queue.entries()) {
    if (deadlineMs && Date.now() >= deadlineMs) {
      console.log(
        `Deadline reached; stopping. ${queue.length - i} of this run unsent.`,
      );
      break;
    }
    // WHY two separate try blocks: a send failure should skip-and-continue,
    // but a BOOKKEEPING failure after a successful send must ABORT the run —
    // continuing without durable dedup state is how the same person gets the
    // email twice (Codex review 2026-07-28, CRITICAL-1).
    let delivered = false;
    try {
      await sendOne(r.email, r.first_name);
      delivered = true;
    } catch (err) {
      console.error(
        `[${i + 1}/${queue.length}] FAILED ${r.email}`,
        err.message,
      );
    }
    if (delivered) {
      try {
        sent[`${SHOW.campaign}:${r.email}`] = new Date().toISOString();
        saveSent(sent);
      } catch (err) {
        console.error(
          `FATAL: ${r.email} WAS SENT but the sent log could not be written (${err.message}). ` +
            "Stopping immediately — record this address by hand before rerunning, or they will be emailed twice.",
        );
        process.exit(1);
      }
      console.log(`[${i + 1}/${queue.length}] sent ${r.email}`);
    }
    if (i < queue.length - 1) {
      const wait = jitter();
      console.log(`waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  if (unsent.length > queue.length) {
    console.log(
      `Stopped at the ${effectiveLimit} send limit. ${unsent.length - queue.length} remain; ` +
        "rerun after the 24h window to continue (already-sent people are skipped).",
    );
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
