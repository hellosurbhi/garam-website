# Claude implementation review

Reviewer: Claude Sonnet 5.5, high effort, independent source snapshot. The initial tool-based call exhausted its turn budget. A later JSON-only call omitted the first findings response. The complete streaming review requested changes; no approval was inferred from either incomplete output.

## Findings and disposition

- Custom subjects were ignored because of operator precedence. Fixed with explicit grouping and a recovery-subject regression test.
- Parallel upload starts could race their ledger preconditions. Fixed with a per-ledger promise queue and copy-before-persist behavior. Tests exercise concurrent starts and failed saves.
- Canceled queued jobs could page as harness failures. The reporting job now receives the checks job result and ignores canceled or superseded runs without resetting the scheduled watchdog.
- Scheduled runs could page while a deployment was building. Each initial gate now waits within the same bounded release window. It also checks the current main commit and retires superseded expectations. No additional deployment is created.
- The reviewer asked whether application markers and notifications still used the old constant. Verified useApplyForm.ts uses isSyntheticSubmission for the marker, progressive lead capture and analytics. notify-application.ts and notify-mixer-rsvp.ts already use the same predicate. The legacy constant remains for compatibility.
- Require the marker in both directions for reserved identities. Updated rules and emulator coverage.
- First-party PostHog proxy requests could still count. Confirmed /ingest rewrites in vercel.json and blocked that path only in the synthetic browser, along with Vercel insights. No blanket webdriver behavior was added to customer code.
- Avoid impersonating Googlebot. Ticket checks now identify as GaramMasalaMonitor/1.0, recognized only for analytics exclusion, never authorization or rate-limit bypass.
- Reporting fallback issues could duplicate notification incidents and remain open. Avoid duplicate fallback creation when the notification incident exists and close recovered fallback incidents after two completed reports.
- Malformed ledger JSON could stop the full sweep. Return invalid evidence for isolated refusal while continuing valid ledgers.
- The stronger browser assertion caught small-photo multipart uploads, which the original parser did not journal. Support and validate both SDK upload formats before forwarding, with browser and parser regression tests. Chromium exercises the real multipart parser. WebKit omits Blob postData in the intercepted request, so its isolated fixture verifies the UI submission stages; it does not claim upload-journal proof. Production monitoring remains Chromium and fails closed when metadata is missing.
- Assert SDK upload observations in the browser test body, not solely inside a route callback. Fixed and rerun against both browser engines.
- Anonymous Auth account retention and historical fixed-identity leftovers require additional ownership investigation and permissions. Full bounded plans are queued in BUGS.md. They are not silently included in customer-data deletion.

Weekly heartbeats prove provider acceptance; the runbook requires separate inbox receipt verification. A repeated manual drill inside the site's dedupe window is deliberately not reported as fresh delivery. The reporting script and pager use only Node built-ins and local modules, so that job does not install dependencies.

## Operational prerequisites

Existing Firebase and Gmail secret names were confirmed without reading values. Neither external watchdog entry exists. No production form submissions, customer-record mutations, rules deployments or credential changes were performed during implementation. Activation remains gated on the matching release, reviewed rules, watchdog configuration and an authorized delivery drill.

## Final follow-up

Claude Sonnet 5.5 returned: "Approve. I found no remaining concrete blockers in the files you pasted." This was a source review, not independent execution. Its final snapshot covered the ledger and multipart parser, deployment gate, reporter, browser fixture, Firestore rules and workflow. Earlier rounds covered the administrator adapter and supporting code.

The final concerns were checked against the implementation:

- scripts/synthetic/admin.mjs:55 records the HTTP server Date. Its now method at line 74 refuses missing server time. Cleanup does not rely on the runner clock.
- playwright.synthetic.config.ts uses Playwright's default Chromium browser with one mobile viewport project. The local WebKit limitation does not apply to this production suite.
- Superseded scheduled checks do not prove monitoring coverage. The external missing-run alarm remains intentional after the documented grace period; it does not claim customer signup failure.
- Same-run reruns do not count as independent recovery checks. Two later healthy run IDs are needed to close an incident.
- A failed preceding upload journal aborts dependent uploads. This preserves the requirement to record evidence before forwarding.
- Manual runs must target main. A feature-branch dispatch is reported as a deployment configuration failure.

Main's order-sync change was integrated without replacing either side's safeguards. src/pages/api/sync-orders.ts retains synthetic lead exclusion alongside bounded concurrency, retry classification and the start-of-run cursor. The combined branch passed 1,592 unit tests, lint, Astro check and production build with packaged runtime. Monitoring-specific verification passed 84 emulator rule tests and 28 isolated browser checks. Local Redis was unconfigured and its real PING was skipped; this is not claimed as live Redis verification.
