# Automatic show email

The admin dashboard's Show emails tab saves a show and its announcement, Monday reminder and Friday reminder. Saved reusable copy fills in the city, date, venue and ticket link. The hosted sender does not need an open laptop or an agent session.

## Operating behavior

Announcement delivery starts after the show is saved while automatic sending is enabled. Monday and Friday reminders become due at 9 AM in the show's timezone. Past reminders and reminders after showtime are skipped. Only the current milestone sends after an outage, so old reminders do not arrive in a burst. A recipient snapshot is taken when that milestone first runs. New subscribers join subsequent milestones.

Two Gmail accounts are supported. Each has an independent rolling allowance of 450 attempts per 24 hours and a minimum two minute gap. These are application ceilings, not a promise of provider capacity. A confirmed rate rejection waits for its cooldown and resumes automatically. A lost send response is held for investigation because Gmail may already have accepted the message. The dashboard distinguishes sent counts from recipients still outstanding. An unsubscribe is checked immediately before each attempt.

The audience refresh runs on the first worker tick after 12:00 UTC each day. It reads the website's leads, applications and contestants collections, skipping deleted records. Historical contacts, suppression and previous announcements are imported once from the private outreach folder. The preparation script also records the latest Gmail send time so the new worker waits out the old sender's rolling window. After activation, the old laptop sender must remain stopped; it does not share the online account reservations.

Show records also drive the home page, tickets page, city pages, links page, individual event pages and tracked ticket redirects when online publishing is enabled. Existing catalog records are retained as migration seeds and are overridden by managed records with the same ID. The existing contestant workflows and text reference feeds still use the legacy catalog; their integration is queued in `ENHANCEMENTS.md`. Pausing a show's emails does not unpublish it. The separate Publish on the website checkbox controls publication.

## One-time release setup

This branch does not activate production. Configure the server through the hosting dashboard without committing credentials:

1. A hosting plan that supports the two minute cron in `vercel.json`. Vercel Hobby permits only daily cron schedules, so this schedule requires a compatible paid plan or a separately configured hosted scheduler.
2. `OUTREACH_GMAIL_ACCOUNTS`: a JSON array with one or two objects containing `address`, `clientId`, `clientSecret` and `refreshToken`. Addresses must end in `@gmail.com`. OAuth consent must include Gmail sending and email identity access. The worker verifies each token's mailbox before sending. Credentials stay on the server and are never returned to the browser.
3. `OUTREACH_UNSUBSCRIBE_SECRET`: at least 32 characters of random signing material. Preserve it across deployments so existing unsubscribe links remain valid.
4. The existing Firebase server configuration and `CRON_SECRET`. The online worker runs only with `VERCEL_ENV=production` and `OUTREACH_ONLINE=1`. Keep online publishing off until migration verification is complete.
5. Prepare the private audience file with `scripts/prepare-email-audience.py`, using the private outreach folder's Python environment with openpyxl installed. The script takes a source folder and an output filename outside this repository. It reads no credentials and sends nothing. Upload that file using the admin import control. Suppressions and history import before the completion marker permits sending.
6. Verify the production worker heartbeat, Gmail identities and import counts. Send a controlled test campaign to a dedicated test audience before enabling the real shows. Do not use real subscribers for the release smoke test.

The local preparation completed with 1,628 source contacts, 76 suppressions and 3,198 unique historical show/recipient records. Invalid contact addresses are excluded on import. These counts describe the prepared file, not a completed production import.

## Storage and recovery

Server-only Firestore collections are `emailSettings`, `emailShows`, `emailContacts`, `emailSuppression`, `emailHistory`, `emailAccounts`, `emailJobs` and `emailSystem`. Existing Firestore client rules deny access to these collections by default. Admin API requests require the existing verified admin token.

The storage adapter uses Firestore update-time preconditions for settings, mailbox reservations and delivery status. A new delivery intent uses a create-only precondition. Sender crashes leave an intent that is not automatically resent. The recorded subject and body are the actual rendered copy. Gmail's returned message ID marks successful acceptance, not inbox placement.

If a delivery is uncertain, open its review panel in the dashboard and check the sending account's Sent folder before choosing either outcome. The panel records the admin identity and the chosen resolution. Do not delete its record to force a resend. A sender error leaves the last heartbeat visibly stale. The worker endpoint returns an error status instead of claiming completion.

## Verification

Unit tests exercise dates, daylight saving changes, late-added shows, pacing, concurrent workers, suppression, provider cooldowns, Gmail identity and ambiguous acceptance. API tests cover authentication and conflicting saves. A browser check uses fake API data to verify add, preview, save, edit and a narrow mobile viewport. Real Gmail acceptance and production Firestore behavior still require the controlled release smoke test.

Provider references: [Vercel cron scheduling](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Gmail error handling](https://developers.google.com/workspace/gmail/api/guides/handle-errors), [Gmail send API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send).
