# Production monitoring

## What runs

Unit and Firebase emulator tests validate behavior before release. The local browser fixture builds with public nonfunctional Firebase identifiers and blocks unmocked writes. Its build child receives only allowlisted process essentials and fake public Firebase identifiers, with an empty temporary directory used for environment-file loading. Its Apply check reaches the actual SDK upload request shape without claiming a mocked Firestore acknowledgment is a real saved application.

The production workflow checks the deployed commit and deployed rules before submitting one application and one Notify Me lead. Each retry has its own UUID email and private cleanup ledger. Test traffic is excluded from customer lists, marketing and reporting. These checks exercise real Firebase authentication, Storage and Firestore rules.

Four scheduled runs execute daily. Each trigger waits up to 28 minutes for its deployed version. A newer main commit supersedes an older waiting check without raising a customer-flow incident. Polling may be superseded; submission and cleanup jobs are serialized and never intentionally canceled by a newer run. Check and report groups retain up to 100 pending jobs using GitHub’s maximum queue; excess arrivals can still be canceled by the platform. GitHub schedules can start late, so this is not a guaranteed six-hour detection SLA.

## Cleanup safety

The service account creates a syntheticRuns document before each attempt. The browser observer persists the exact upload path and owner before forwarding the real upload. Evidence cannot be read or written by browser clients. It contains no authentication tokens.

Cleanup matches the UUID identity, marker, document creation time and recorded photo paths. Photos require matching ownership and generation. Documents require matching updateTime. Both are read again to prove absence. Missing objects are already clean, not errors.

A later scheduled run recovers ledgers older than one hour. Three failed sweeps trigger one escalation and daily retries. Failed evidence never expires. Successful evidence is retained for seven days, checked for late writes and removed only after another successful absence check. Ambiguous records are left untouched with an open incident.

## Operator steps and release gates

Implementation does not authorize an agent to bypass repository restrictions on production deployment or credentials.

1. Merge the reviewed code. Confirm /api/version reports that commit. Normal customer leads carry no new marker, so their payload stays compatible during the transition.
2. Publish the reviewed Firestore rules through the authorized release process. Confirm scripts/check-rules-drift.mjs passes against both deployed rulesets. The monitor makes no new submissions while version or rules differ.
3. Reuse the existing FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET workflow secrets. The administrator identity must be able to read deployed rules, manage syntheticRuns and conditionally delete verified test records/photos. Do not broaden public rules to grant these privileges.
4. Configure two Healthchecks.io checks on the free plan. The regular check uses a six-hour period and three-hour grace. The weekly notification check uses a seven-day period and one-day grace. Connect email delivery to the owner. Store the protected ping URLs as MONITOR_WATCHDOG_URL and MONITOR_WEEKLY_WATCHDOG_URL. Account authorization and these new protected URLs are prerequisites, not assumed existing configuration.
5. Run the production workflow and inspect the exact-attempt verification and sanitized cleanup report. Confirm real ticket redirects. The packaged runtime Redis PING proves deployment-time connectivity when production credentials are supplied; it is not continuous Redis monitoring.
6. With authorization to send a labelled drill, dispatch test_pager. Confirm inbox receipt separately from provider acceptance. Exercise missing-run notification with a temporary short-duration external check, then remove that test check through its authorized account. Never create a customer-facing outage for a drill.

The implementation agent owns preparing and checking these gates. Missing access or approval must be reported explicitly. Do not call monitoring operational while rules, watchdog configuration, notification receipt or cleanup acceptance remain unverified.

## Incident interpretation

Deployment mismatch means the intended release was not verified. Harness failure means testing itself failed. A signup check failure can be a form error or shared-runner rate limiting; customer impact needs investigation. A changed commit during testing makes the flow result inconclusive but does not suppress cleanup failure.

The final reporting job runs independently of setup and browser failures. Gmail is primary, the site alert is an independent fallback and GitHub issues retain incident state. A provider accepting a message is not proof of inbox receipt. The site returns 503 when all delivery channels fail and distinguishes deduplicated requests from fresh acceptance.

Issues are deduplicated by category, with recovery after two checks that actually exercised the affected phase. The scheduled external heartbeat fails on harness or notification problems. Post-merge and manual runs cannot conceal a missing scheduled run. Raw browser traces are disabled because they can contain authentication tokens.
