# Waitlist sender (Gmail API)

One to one plain text emails from the brand Gmail, built to land in Primary instead of Promotions: no HTML, no tracking pixels, no unsubscribe header, one recipient per message, 45 to 95 second random gaps between sends.

## One time setup

1. Google Cloud Console (signed in as the sending Gmail): create a project, enable the Gmail API, configure the OAuth consent screen (External, then Publish app), and create a Web application OAuth client with `http://localhost:3000/oauth2callback` as an authorized redirect URI.
2. Add this block to `.env.local` and fill in the first two values (the repo's env guard keeps these out of `.env.example`, so this README is the canonical reference):

   ```
   GMAIL_CLIENT_ID=
   GMAIL_CLIENT_SECRET=
   GMAIL_REFRESH_TOKEN=
   GMAIL_USER=garammasaladating@gmail.com
   FROM_NAME=Wyatt
   ```
3. `npm run waitlist:auth`, open the printed URL, approve, paste the printed `GMAIL_REFRESH_TOKEN=...` line into `.env.local`.

## Per campaign

1. Copy `waitlist-v1.example.csv` to `waitlist-v1.csv` and fill it with real recipients (`first_name,email,city,unsubscribed`). The real CSV and the sent log are gitignored so personal emails never reach GitHub.
2. Edit the `SHOW` block at the top of `send-waitlist-gmail-v1.mjs`: ticket `link`, discount `code` and a fresh `campaign` key (for example `nyc-2026-08-15`). The campaign key is the dedup key in the sent log, so a reused key means those people are skipped as already sent. Update `subjectFor()` and `bodyFor()` if the copy changes.
3. `npm run waitlist:dry` and read the printed email.
4. `npm run waitlist:test -- you@yourmail.com`, then check which Gmail tab it lands in.
5. `npm run waitlist:send`. Leave the terminal open; roughly one send per minute. Crash safe: every success is logged immediately, so rerunning never double sends.

## Limits

Free Gmail allows about 500 recipients per rolling 24 hours; going over can suspend outbound mail on the account for a day or more. The sender stops at 450 per run by default. `npm run waitlist:send -- --limit 100` lowers it for a partial run; rerun the next day to continue where it left off.

## Replies

Anyone who replies "stop": set their `unsubscribed` column to `true` in the CSV (and suppress them in the master audience list). Anyone who names a new city: update their `city` column and the master list.
