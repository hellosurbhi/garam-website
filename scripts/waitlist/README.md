# Waitlist sender (Gmail API / Brevo / Resend) + mandatory queue gate

One to one plain text emails built to land in Primary instead of Promotions: no tracking pixels, no unsubscribe header, one recipient per message, slow human-pace gaps (2.5 to 4 minutes on the Gmail path, 55 to 95 seconds on the ESP paths). There is deliberately NO Zoho transport: Zoho Mail bans batch sending and blocked the account for it on 2026-07-25.

**Every recipient list must pass `build_queue.py` before the sender will touch it.** The gate validates everything (junk and test addresses, typo domains, role and service addresses, suppression lists, per-campaign sent-log dedup, region rules, movers, duplicate aggregation, cross-queue overlap) and publishes a `.manifest.json` binding the file's sha256, campaign key and filename. The sender refuses any list that is unsigned, edited after gating, renamed, or gated for a different campaign. This exists because ad-hoc hand-built queues shipped junk recipients and out-of-region sends on 2026-07-25/26.

## Data lives outside git

This directory holds the versioned CODE only. The real suppression list, Klaviyo exclusion snapshot, master audience workbook, recipient CSVs, sent logs and credentials live in the private (never-git) data folder on the operator's machine, and the gate hard-errors listing exactly what is missing if run without them. Create `suppressed.csv` here from `suppressed.example.csv` before any send (the sender refuses to run without a kill list). `test_build_queue.py` runs anywhere — it builds its own synthetic fixtures (needs Python with openpyxl plus node).

## One time setup

1. Google Cloud Console (signed in as the sending Gmail): create a project, enable the Gmail API, configure the OAuth consent screen (External, then Publish app), and create a Web application OAuth client with `http://localhost:3000/oauth2callback` as an authorized redirect URI.
2. Add this block to `.env.waitlist.local` and fill in the first two values (the repo's env guard keeps these out of `.env.example`, so this README is the canonical reference):

   ```
   GMAIL_CLIENT_ID=
   GMAIL_CLIENT_SECRET=
   GMAIL_REFRESH_TOKEN=
   GMAIL_USER=garammasaladating@gmail.com
   FROM_NAME=Wyatt
   ```

3. `npm run waitlist:auth`, open the printed URL, approve, paste the printed `GMAIL_REFRESH_TOKEN=...` line into `.env.waitlist.local`.

## Per campaign

1. Assemble a candidates CSV (`first_name,email,city,state,unsubscribed`), then gate it:
   `python3 scripts/waitlist/build_queue.py candidates.csv scripts/waitlist/waitlist-v1.csv --campaign nyc-2026-08-15`
   The campaign key must match the sender's `SHOW.campaign` or the sender refuses the queue. Read the printed drop report and the `.dropped.csv` audit.
2. Edit the `SHOW` block at the top of `send-waitlist-gmail-v1.mjs`: ticket `link`, discount `code` and the same fresh `campaign` key. The campaign key is the dedup key in the sent log, so a reused key means those people are skipped as already sent. Update `subjectFor()` and `bodyFor()` if the copy changes.
3. `npm run waitlist:send-dry` and read the printed email.
4. `npm run waitlist:send-test -- you@yourmail.com`, then check which Gmail tab it lands in. Test sends validate the address and honor the kill list too.
5. `npm run waitlist:send`. Leave the terminal open. Crash safe: every success is logged immediately, so rerunning never double sends. Never compress the gaps to hit a deadline — that is how the Zoho block happened.

Building queues for multiple channels in parallel: build them in one sitting and pass each earlier queue via `--exclude-list`; the gate also hard-fails on overlap with any other same-campaign manifest in the directory.

## Limits

Free Gmail allows about 500 recipients per rolling 24 hours; going over can suspend outbound mail on the account for a day or more. The sender stops at 450 per run by default. `npm run waitlist:send -- --limit 100` lowers it for a partial run; rerun the next day to continue where it left off.

## Replies

Anyone who replies "stop": add them to `suppressed.csv` with a reason (that file wins over every queue, forever). Anyone who names a new city: record it in `location-updates.csv` (`email,new_region,new_city`) — movers are honored by the gate in both directions. Suppressed people stay in the Meta lookalike seed; suppression gates sending only, never ad audiences.
