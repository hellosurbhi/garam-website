# Lessons

## The rules fix for the August outage caused a September outage because its deploy step merged as a placeholder

**What went wrong:** PR #244 (the fix for the August "Missing or insufficient permissions" outage) merged on Aug 31 with its Operator steps section still reading "OPERATOR STEPS INCOMPLETE". Vercel auto-deployed the new client code, but the matching `firestore.rules` publish is a manual human step, and the instructions for it never existed. For two days production ran new client code against old rules: leads carrying the new name/Instagram fields, applications with long answers and every photo-failure submission were rejected. The synthetic monitor's drift check caught it on the first post-merge run and paged twice a day into issue #247. Then the first recovery attempt failed too: the deploy was run from a stale main checkout, and firebase-tools printed "latest version of firestore.rules already up to date, skipping upload" while re-releasing the OLD rules, so the monitor stayed red until the deploy was rerun from a current copy of main.

**Why:** Two wrong assumptions. (1) That merging the PR shipped the fix: a change split across an auto-deployed half (client) and a manually-deployed half (rules) is not shipped until BOTH halves are live, and the placeholder meant the manual half had no owner and no instructions. (2) That running the deploy command is the same as deploying the repo's rules: firebase-tools publishes whatever file sits in the checkout it runs from, and a stale checkout makes the command succeed loudly while changing nothing.

**Rule:** A PR that touches `firestore.rules` (or any manually-deployed artifact) is not done at merge; it is done when the synthetic monitor's drift step prints "OK: firestore.rules matches the deployed ruleset", and whoever merges must run that verification the same day. Rules deploys start with `git pull --ff-only` in the checkout being deployed from, and a "skipping upload" line in deploy output means the local file matched what was already uploaded, which after a rules change in the repo is evidence of deploying from the wrong checkout, not of success.

## A green synthetic monitor proved the happy path while every long-form applicant was rejected

**What went wrong:** The 6-hour synthetic apply monitor was green 10 runs straight while real applicants (Akshay Aug 30, Dua Aug 27 with 4 retries) got "Missing or insufficient permissions" and their applications were silently thrown away. The Firestore rules capped pitch at 2000 chars, phone at 20 and height at 20; the client validated none of these lengths, and one field (`type`) even had a form `maxLength={200}` four times larger than the deployed rules cap of 50. Anyone who wrote a long pitch, a spelled-out height or a formatted phone number was rejected at the last possible moment with a generic error, after doing all the work.

**Why:** Two wrong assumptions. (1) That the monitor's green meant the form worked: the monitor filled only the short required fields, so it exercised a payload shape no rejected human ever sent. A monitor only proves the inputs it submits. (2) That the client and rules agreed on field limits: nothing pinned that contract, so the rules' caps and the form's validation (none) and the form's own maxLength attributes drifted three separate ways. The rules also count `size()` in bytes while JS `.length` counts UTF-16 units, so even equal-looking caps disagree on multi-byte text (emoji, accented names).

**Rule:** Every client/rules validation pair must be provably consistent, pinned by emulator tests that build payloads through the real client builder with realistic long, multi-byte values (a 40,000-char pitch, emoji text, `5 feet 8 inches (172cm)`), and rules caps must be a 4x multiple of client caps so the byte-vs-UTF-16 counting gap can never reject what the client accepted. A synthetic monitor must submit the most realistic filled form, not the minimal valid one: any field a real user fills that the monitor leaves blank is a blind spot exactly where users diverge from tests. And any limit a user can cross must produce an inline error on the field before submit is clickable, never a generic backend rejection after.

## Patch-coverage gate counted statement hits only, so it failed already-tested code

**What went wrong:** CI's "Lint, Types, Test, Build" check failed with "patch coverage 76.3% is below the 80% threshold" on a PR whose changed lines were, line by line, either already covered by an existing test or physically impossible to instrument (imports, blank lines, comments, type declarations). The tests were fine; the gate was wrong.

**Why:** `scripts/diff-coverage.mjs` only read Istanbul's `statementMap`/`s` (statement hit counts) from `coverage/coverage-final.json`. Two gaps in that model caused false negatives: (1) `@vitest/coverage-v8` (v8-to-istanbul, unlike AST-based `babel-plugin-istanbul`) never gives a function's own signature line a `statementMap` entry, so a called function's declaration line reads as "uncovered" even with real `fnMap`/`f` hit data proving otherwise; (2) v8-to-istanbul attributes a Prettier-wrapped multi-line declaration (e.g. `const referrerHost =\n  safeSessionStorage.getItem(...) ?? undefined;`) to the line the initializer expression starts on, leaving the `const x =` opener line with zero `statementMap` coverage of its own, despite the next line's hit count proving the whole statement ran. Neither gap is a test problem: no test can make an import line or a hoisted declaration's opener line show up in `statementMap`.

**Rule:** A statement-only coverage gate will always false-flag function-signature lines and Prettier-wrapped declaration openers as untested. Any custom patch-coverage script must also: credit `fnMap`/`f` hits (using the narrow `decl` range, not the full `loc` body, so a called-but-partially-tested function doesn't get its whole body waved through), exclude structurally uninstrumentable lines (blank, comment, bare bracket, import, type/interface) from the denominator entirely like `diff-cover` and Codecov's patch check do, and rescue a still-uncovered line that ends in a continuation token (`=`, an opener, `&&`, `||`, `??`, `=>`) when the very next line is proven covered. Before renaming a well-named variable or restructuring code just to dodge a coverage gate's line count, check whether the gate's line-attribution model is the actual bug.

## Two rules-test files sharing one emulator project ID race each other's `clearFirestore()`

**What went wrong:** `npm run test:rules` (and CI's "Firestore/Storage rules (emulator)" check) failed intermittently with `PERMISSION_DENIED: evaluation error ... Null value error` on an `update` whose document had just been seeded a line earlier in the same test, then passed clean on an immediate retry with zero code changes. It looked like emulator flakiness worth shrugging off.

**Why:** `test/rules/public-write.rules-test.ts` and `test/rules/apply-flow.rules-test.ts` both hardcoded the identical `PROJECT_ID = "demo-garam-masala"` and each ran its own `beforeEach(() => testEnv.clearFirestore())` against it. `vitest.rules.config.ts` has no `fileParallelism: false`, so Vitest's default parallel file execution runs both files as concurrent workers against the one running emulator instance. Since a project ID is the emulator's actual isolation boundary, both files shared the same live document store: whichever file's `beforeEach` fired in the other file's window wiped the document the other test had just seeded, so the rule evaluated `resource.data` as null mid-assertion. A same-run `Transaction lock timeout ... ABORTED` on an unrelated test was the same symptom on a different code path, not a second bug.

**Rule:** Every `*.rules-test.ts` file gets its own unique `demo-`-prefixed project ID (never share one across files). The Firestore/Storage emulator is multi-tenant by project ID specifically so independent test files can run in parallel without coordinating `clearFirestore()`/`clearStorage()` calls; giving each suite its own project removes the shared mutable state instead of serializing file execution to hide it. Before writing off a "flaky, passes on retry" emulator failure, check for this pattern first: identical project IDs across files that each call a clear-all method in `beforeEach`.

## A literal backslash-n in a secret becomes a bogus URL path segment, not an error

**What went wrong:** The synthetic apply monitor's rules-drift check (`scripts/check-rules-drift.mjs`) failed on 2026-08-26 with a 404 whose body echoed back `/v1/projects/***/n/releases/cloud.firestore`, an extra `/n/` segment nobody wrote. The `FIREBASE_PROJECT_ID` GitHub Actions secret carried a literal trailing `\n`, two printable characters (backslash then the letter n), not a real newline: real newline/tab/CR bytes are already stripped by the WHATWG URL parser and by `.trim()`, so this shape survives both. The run self-resolved when someone fixed the secret before the next scheduled run.

**Why:** `\` is a path separator in special-scheme (http/https) URLs per the WHATWG URL spec, so a value ending in `\n` interpolated into a template-literal URL doesn't throw or 400, it silently becomes a new path segment (`/n/`) and the request 404s against a plausible-looking but wrong URL. This is the same secret-corruption class already documented for Vercel env vars ([[reference_vercel_env_gotchas]]: values can end in a literal `\n` that `.trim()` alone doesn't catch when it's this two-character form), now recurring in a GitHub Actions secret instead of a Vercel one.

**Rule:** Any script that interpolates an env var into a URL must sanitize it first: `.trim()` for real whitespace plus an explicit `.replace(/\\n$/, "")` for the literal two-character form, matching `src/lib/env.ts`'s `readTrimmedEnv`/`readPrivateKeyEnv` pattern. Plain-node CI scripts that cannot import that TypeScript module duplicate the same two-line helper rather than reading the raw value. Never assume a 404 against a URL that "looks right" in a log means the resource is missing, print the actual constructed URL and check for a stray path segment first.

## A push-time test gate that's backwards is worse than no gate

**What went wrong:** Five contestant-workflow PRs (P1 to P5) shipped 2026-07-03 to 07-05 with zero unit tests, and the pre-push Stryker mutation gate never caught it. A later push then printed "STRYKER FAILED: Mutation score dropped" immediately followed by "All pre-push checks passed", the exact opposite conclusion, in the same output.

**Why:** Two separate bugs compounded. First, the gate's own condition ran Stryker only if a test file had changed in the last 7 days, meant to save time on unrelated pushes, but this is backwards: it skips exactly the PRs that add production code with no test at all, which is the case that most needs catching. Second, the invocation was `run_stryker || true`, so even a real regression could never fail the push; the "All pre-push checks passed" line printed unconditionally afterward regardless of what Stryker actually found.

**Rule:** A slow, thorough check (mutation testing, 15 to 20 minutes) does not belong on the push path at all, gated or not; it belongs on a schedule, reviewed by a human (see CHANGELOG.md, 2026-07-16, `.github/workflows/mutation-audit.yml`). The checks that do belong on the push/PR path are fast and precise: the full test suite on every commit (already `.husky/pre-commit`) and patch/diff coverage in CI on the lines a PR actually changed (`scripts/diff-coverage.mjs`), not a proxy like "did a test file change in the last N days" or a ratchet that can invoke its own failure branch with `|| true` and still report success.

## A monitor that cannot name the root cause gets blamed instead of believed

**What went wrong:** The synthetic apply monitor went red on its first run (Aug 12) and stayed red for 28 straight runs while every real application also failed. Nobody trusted the signal: the task arrived a week later as "investigate the apply monitor and fix it", when the monitor was the only healthy part of the pipeline. Two distinct root causes sat underneath: the PR #135 rules were never manually deployed (so the auto-deployed client's `photoPaths` field was rejected by the stale whitelist), and independently the client sent `""` for blank optional fields (plus `referrerName: ""` on every Self application) where the repo rules demand `size() > 0`.

**Why:** Three wrong assumptions compounded. (1) The drift check that would have printed "deployed rules are stale" on day one was ordered AFTER the Playwright step, which always failed first with an opaque 45 second locator timeout, so the one diagnostic that named the cause never executed. (2) The rules test fixture claimed to be "the exact document the apply flow writes" but was hand rolled: it filled every optional field and omitted the `referrerName` key entirely, so it passed while the real payload failed. (3) The monitor and the fix it was built to verify shipped in the same PR, so the monitor's first-ever run required a manual operator step (rules deploy) that had not happened, making "monitor is broken" the natural misread of "monitor is right".

**Rule:** Order monitor steps by diagnostic value, cheapest and most causal first: config/contract drift checks run before end-to-end browser steps, so a red run names its cause instead of timing out. Any fixture described as "the exact payload the client writes" must be produced by the production code path (import the real builder), never hand rolled. And a monitor must be born green: when a new monitor's first run depends on a manual operator step, the PR is not done until that step is confirmed executed, or the monitor will cry wolf from day one.

## A lockfile that installs locally can still fail CI's npm ci

**What went wrong:** A dependency change (npm override forcing @puppeteer/browsers 3.2.0) produced a lockfile that installed and passed every local gate, then failed CI's `npm ci` with "package.json and package-lock.json are in sync" errors about a proxy-agent subtree nobody visibly depends on.

**Why:** @puppeteer/browsers 3.2.0 declares proxy-agent as an optional peer dependency (peerDependencies plus peerDependenciesMeta optional: true). npm 10, which node 22 bundles on CI, resolves optional peers into the lockfile and its `npm ci` validator requires those entries; local npm 11 leaves them out of the lockfile it writes. Same package.json, two npm majors, two opinions about what a complete lockfile is.

**Rule:** Every environment that runs `npm ci` must use the same npm major that wrote the lockfile. The pin is enforced at three layers: all five CI `npm ci` sites and Vercel's installCommand run `npm install -g npm@11` first, package.json declares `engines.npm >=11.0.0 <12.0.0` (bounded above so the next npm major cannot slip through either), and the checked-in `.npmrc` sets `engine-strict=true` so a wrong-major install fails loudly instead of silently rewriting the lockfile. When the pinned npm major changes, change it in every workflow plus vercel.json plus engines.npm and regenerate package-lock.json in the same commit; after any lockfile rewrite, `npm ci --dry-run` with the pinned major is the cheap pre-push validation.

## The markdown formatter rewrites conflict markers into invisible-to-grep debris

**What went wrong:** A merge of main left `>>>>>>> origin/main` markers in CHANGELOG.md and LESSONS.md. The post-edit prettier hook reformatted the files between the conflict edits, turning the markers into blockquote text (`> > > > > > > origin/main`). A `grep` for `>>>>>>>` then reported the files clean, the merge commit shipped the debris and the pre-push reviewer had to catch it.

**Why:** Prettier treats a leading `>` run in markdown as nested blockquotes and normalizes it with spaces. The standard marker grep only matches the literal seven-character run, so it misses the reformatted version. The two cleanup edits that "failed with string not found" were the actual warning sign: the formatter had already rewritten the target text, not removed it.

**Rule:** After resolving conflicts in any markdown file in this repo, verify with a formatter-proof check: grep for the branch names themselves (`origin/main`, `HEAD`) or the word-spaced form `> > >`, not just `<<<<<<<`/`>>>>>>>`. And when an Edit fails because a just-resolved conflict region "does not exist", re-read the file; assume the formatter rewrote it, never that the cleanup already happened.

## A fix that was never pushed is a fix that never happened

**What went wrong:** The Eventbrite embedded-checkout removal (tracked redirect, per-show landing pages, Meta CAPI) was fully built and Codex-reviewed by 2026-08-03 on `feat/event-pages-tracked-checkout`, but the branch was never pushed: no remote ref, no PR, nothing visible on GitHub. For four weeks the live site kept the embedded popup with its 2.5 second silent-failure fallback, and the owner experienced 5 to 10 second ticket clicks she believed had been fixed. The gap only surfaced when she reported the symptom on 2026-08-14.

**Why:** The session that built it ended after the last local commit without completing the push, and nothing audits local-only branches. Every safety net in the pipeline (pre-push review, auto-PR, ready-check notifications, nightly review of the main delta) triggers on push or later, so work that never reaches `git push` is invisible to all of it. The owner cannot see local branches, so "built and reviewed" looked identical to "shipped".

**Rule:** When a fix the owner believes shipped is still misbehaving, check for local-only branches first: `git branch -a` entries with no `origin/` counterpart and no PR are the prime suspect. And a task is not done at the last commit; it is done when the branch is pushed and a PR exists, which is why ending a session with unpushed work requires an explicit, stated blocker.

## "Remove this show" never means delete the data

**What went wrong:** Asked to "remove the August 16th New York date", I deleted the whole entry from `events.ts`. The owner had to intervene: she wants every show ever scheduled kept forever, just hidden from the site. The same deletion pattern had already happened on 2026-07-07 (commit 1b80acf erased the canceled Jul 11 Edison and Jul 12 Philadelphia dates while converting the entries to TBA).

**Why:** "Remove" was read as a code operation (delete the object) instead of a content operation (stop showing it). The events file is not code, it is the business's historical record of every show; git history is not a usable archive for a non-coding owner. The repo even had the right precedent already (commit f5124be hid Chicago "without removing from data") and it was not followed.

**Rule:** Destructive-sounding requests against `src/data/` content ("remove", "take down", "cancel") mean hide, not erase: set the status/hidden flag, keep every field, log the change in EVENTS-HISTORY.md. Deleting a data entry requires the owner explicitly confirming the record itself should not exist. Venue constants follow the same rule.

## A third-party widget's init call succeeding does not mean the interaction will work

**What went wrong:** Eventbrite's ticket-buy CTA silently died for a subset of mobile users. It surfaced as seven separate PostHog-filed GitHub issues (#136, #151, #152, #153, #154, #155, #156) over several days before anyone connected them to one cause. `EBWidgets.createWidget()` returned successfully on every affected page load, so none of the existing error handling ever fired.

**Why:** `createWidget()` only registers a click handler; it doesn't verify the checkout modal actually opens. In specific mobile in-app browsers (Instagram/Facebook WKWebView bridge probing, Firefox iOS reader mode) Eventbrite's own `eb_widgets.js` threw asynchronously inside that handler, after our trigger's click listener had already called `preventDefault()`. The raw exceptions reached PostHog error tracking through the global `error` listener in `public/js/posthog.js` and became the seven issues, but no structured `widget_load_failed` event ever fired: the existing modal observers only reacted when the modal appeared (to fire `checkout_opened` and track abandonment) and nothing checked for its absence after a click. Anchor triggers had a real href the suppressed default never used and button triggers had no href at all, so either way the CTA looked simply dead.

**Rule:** Any integration where our code calls `preventDefault()` on a native fallback (a link, a form submit) in favor of a third-party JS SDK must pair that override with a check that verifies the expected DOM or behavior actually appeared, plus a recovery path that restores the native fallback on failure. A successful SDK init call is not proof the interaction will complete. Two constraints on that recovery: observe the appearance itself (a presence check at the deadline misreads an opened-then-closed modal as a failure) and navigate in the same tab, because the deadline fires past the browser's transient activation window and `window.open` gets popup-blocked there.

## Git hooks must be tracked with the executable bit or the gate silently dies

**What went wrong:** A commit sailed through with no review gate. Git printed "The '.husky/pre-commit' hook was ignored because it's not set as executable" and committed anyway. The same hint had appeared in the main checkout without anyone connecting it to a disabled gate.

**Why:** `core.hooksPath` in this repo flips between two states. After `npm install` runs husky's prepare step it is `.husky/_` (husky 9 dispatchers that invoke the tracked files through `sh`, executable bit irrelevant). But it was measured as `.husky` (direct execution of the tracked files) on 2026-07-14, and in that state git silently skips any hook tracked as mode 100644. `pre-commit` and `pre-push` were 100644 while `commit-msg` was 100755, so fresh checkouts and index-mode restores produced dead hooks whenever the config was in the direct state. PR #142 tracks all hooks as 100755, which works in both states.

**Rule:** Every hook file ships as mode 100755 (`git ls-files -s .husky/` must show 100755 for all of them) so the gate survives both hooksPath states. Treat the "hook was ignored" hint as a broken gate, never as noise: stop and fix the cause before committing anything else.

## A new endpoint's required env vars ship with the endpoint or it ships broken

**What went wrong:** The contestant portal claim endpoints 500 in production. `signPortalToken` requires `CONTESTANT_PORTAL_SECRET`, but the secret appeared in no `.env.example` entry, no docs and (most likely) no Vercel environment, so the endpoints could never succeed after deploy. Same shape as the July apply outage, where the fix stayed inert until operator secrets were added.

**Why:** The env var was introduced deep in a library (`src/lib/portalToken.ts`) during a multi-feature recovery branch, and nothing forces a new `import.meta.env` read to surface as a deploy requirement.

**Rule:** Any commit that adds a new required `import.meta.env`/`process.env` read must, in the same commit, add the var to `.env.example` with a generation command, and the PR description must list it as an operator step (add in Vercel, then redeploy). Grep for `import.meta.env` in the diff before shipping any server endpoint.

## Production signup failures need server logs first

**What went wrong:** I treated contestant portal signup failures like client-side fallback problems before checking the live API exception.

**Why:** The user-facing message can be generic while Vercel has the exact server error. In this case, Firebase Admin was failing because the deployed project ID env var had a trailing space.

**Rule:** For production signup/API failures, check the runtime logs first, then fix the failing server boundary. Normalize env vars before passing them into Firebase credentials, token audiences, or Firestore project paths.

## Legacy portal query params should collapse to the clean packet URL

**What went wrong:** I started restoring the old `/contestant-portal?show=...&role=...` branch after seeing one of those URLs fail, even though the product direction was to make the contestant packet simpler.

**Why:** Supporting multiple contestant-packet URL shapes brings back the show-specific/link-management complexity the portal cleanup was meant to remove.

**Rule:** Do not resurrect show-specific contestant portal URLs. Treat old `show`/`role` query-param links as legacy aliases for `/contestant-portal`, clean the URL, and keep the single selected-contestant packet flow.

## Standalone waiver URLs should have one canonical public surface

**What went wrong:** `/waiver` and `/stage-waiver` both existed, and production redirected `/waiver` to `/stage-waiver`, making the site copy and actual URL disagree. The duplicate page also used casual timing copy for a legal requirement.

**Why:** People going on stage need one obvious waiver URL. The copy should communicate that signing is required before stage participation, not minimize the task.

**Rule:** Use `/waiver` as the canonical standalone on-stage waiver page. Redirect old `/stage-waiver` traffic to `/waiver`, and do not use casual "quick/takes 30 seconds" language for required legal signing.

## Direct contestant packet URLs must not be dead ends

**What went wrong:** I made `/contestant-portal` require a private invite/session, so visiting the obvious contestant-packet URL showed an access message instead of the actual selected-contestant packet.

**Why:** The packet URL itself is part of the casting experience. Invite links can prefill show-specific metadata, but the direct page still needs to feel usable and selected, not broken.

**Rule:** `/contestant-portal` without an invite should open the selected-contestant packet form. Do not invent a random show; keep show-specific details only when an invite provides them.

## Waiver signing should not quietly collect marketing opt-ins

**What went wrong:** I left an "Email me about future shows" checkbox in the standalone waiver signing UI, which made the legal signing flow look like a marketing signup form.

**Why:** A waiver page should feel focused and contract-like. Any marketing subscription opt-in has to be deliberately requested and clearly separated from the legal signing moment.

**Rule:** Do not add newsletter/future-show opt-in controls to waiver pages unless the user explicitly asks for them. Standalone waiver submissions should default `mailingListOptIn` to `false`.

## Contestant packets should feel like casting, not generic waiver chores

**What went wrong:** I turned the selected-contestant portal into a generic "Sign your waiver / choose your role" flow and let direct portal visits fall back to a random upcoming show.

**Why:** The contestant entry point is part of the production experience. Selected contestants should feel cast and invited into a real packet, while standalone/spectator waiver signing belongs on its own page.

**Rule:** Keep `/contestant-portal` as a selected-contestant packet, not a generic waiver chore. Direct packet access may ask only for the contestant track needed for prep, female contestant or male contestant. Do not add spectator/on-stage-audience options to the portal, do not silently choose a random show, and keep standalone waiver signing at `/waiver`.

## Contestant prep content must preserve real role-specific guidance

**What went wrong:** I collapsed female and male prep into mostly the same content with only arrival-time differences, which lost the actual guidance that made the prep page useful.

**Why:** The male and female contestant tracks share most prep, but the differences are not cosmetic. They include how the audience responds, how to handle chemistry, and how to show up on stage.

**Rule:** When consolidating contestant prep, preserve substantive role-specific guidance. Do not replace it with generic arrival copy. For show-specific packets, derive call time from the show start time instead of hardcoding one-off arrival times.

## Internal legal notes are not signer-facing waiver copy

**What went wrong:** I rendered the raw waiver markdown directly, which exposed an internal "IMPORTANT NOTE FOR PRODUCER" and showed Markdown separators/placeholders to signers.

**Why:** Source documents can include drafting or operations notes that are useful internally but should not appear in the signed public experience. Raw Markdown also looks unfinished and undermines trust in a legal signing flow.

**Rule:** Keep canonical source text available for audit, but render signer-facing waivers through a document component that strips internal producer notes and Markdown-only artifacts. The displayed waiver should look like a clean contract/Docusign-style document, while the typed legal-name signature field remains a separate required form control.

## Waiver legal copy is source text; signing controls are separate UI

**What went wrong:** I edited the contestant waiver legal copy and removed the portal's "Type your full legal name as your signature" field while trying to clean up the signing flow.

**Why:** The waiver text is source legal copy and must not be changed unless the user explicitly asks to change the legal document. The standalone typed signature field is the electronic-signature control that replaces DocuSign and belongs in the form UI around the source text.

**Rule:** Do not edit waiver legal text. Keep an explicit typed full-legal-name signature field on waiver forms, validate it against the legal name fields, and require the user to scroll through the waiver before they can agree/sign.

## Consent URLs need the full source copy and explicit noindex handling

**What went wrong:** `/consent` was added as a short notice, but the operational URL for Posh, Partiful, Luma, Meetup, confirmation emails, and venue signage needs the full filming and recording consent copy.

**Why:** A consent URL used outside the site is legal/operational infrastructure, not a marketing page. It must be live, direct, stable, noindexed, and excluded from the sitemap when the policy says not to index it.

**Rule:** When building externally referenced consent or waiver URLs, use the source legal document copy, mark the page `noindex` if requested, exclude it from the sitemap, and add tests so stale short-form language does not replace it.

## Legal consent copy must not promise after-the-fact audience opt-outs

**What went wrong:** Terms still said audience members could ask not to be featured at the event or afterward, which conflicted with the stronger event recording and consent setup.

**Why:** Audience recording language, contestant waivers, and legal notices have to tell one consistent story. A soft opt-out sentence weakens and contradicts the broader media-rights flow.

**Rule:** Audience likeness language in Terms should stay short and point to `/consent`; do not add after-the-fact audience opt-out promises unless the whole recording policy and operational process are intentionally changed.

## Portal clients must not assume JSON bodies

**What went wrong:** The contestant portal signup UI called `response.json()` unconditionally. If an API failure returned an empty body or a non-JSON error page, the user saw `Unexpected end of JSON input` instead of the actual signup problem.

**Why:** API routes should return JSON, but production failures can happen before handler code writes the expected body. Client code still owns the user-facing error state.

**Rule:** Portal and signup clients must parse response bodies defensively with `response.text()` plus guarded `JSON.parse()`, preserve server-provided `error`/`message` fields when present, and fall back to a human-readable support message when the body is empty or unreadable.

## Ticket checkout must resolve back to `/tickets`

**What went wrong:** Homepage Eventbrite checkout triggers could leave users on the homepage when the checkout behaved like a full-screen page, especially on mobile where users rely on the browser back button.

**Why:** A third-party checkout modal is not a normal lightweight dialog on every device. Treating it as a homepage modal breaks the expected navigation fallback.

**Rule:** Homepage ticket CTAs that open Eventbrite checkout should route through `/tickets?event=...`, and `/tickets` should own the checkout modal history state. Browser/mobile back closes checkout to `/tickets`; outside click closes the overlay on desktop.

## Keep expensive automation off the normal commit path

**What went wrong:** Browser smoke tests, repeated installs, full unit/build checks in hooks, and scheduled maintenance workflows made this small event site feel like it was spending GitHub Actions budget without proportionate risk reduction.

**Why:** Enterprise-quality automation is about putting the right checks at the right cadence, not running every possible check on every commit or push.

**Rule:** PR CI should stay lean and deterministic: lint, Astro checks, unit tests, and build in one job. Playwright/browser smoke, mutation testing, production crawls, and SEO maintenance belong on automatic schedules, not memory-dependent workflows and not every commit/push. Local hooks should stay fast enough that they remain enabled.

## Never work or push directly on `main` or `master`

**What went wrong:** The branch was used for commits and pushes while it was still named `main`.

**Why:** That makes it too easy to publish incomplete or risky work from the default branch.

**Rule:** Always create or switch to a feature branch before committing or pushing implementation work. Check the current branch first, and stop if it is `main` or `master`.

## Keep enhancement backlog items as documentation until explicitly asked to build

**What went wrong:** After being asked to continue, I treated a high-priority `ENHANCEMENTS.md` backlog item as permission to start implementation work.

**Why:** A backlog item marked "Needs implementation" describes future work, but it is not the same as a direct build request.

**Rule:** When the visible task is an enhancement plan, update the planning document only unless the user explicitly asks to implement the feature. If the request is ambiguous, confirm the intended scope before starting code changes.

## Never focus the close button when opening a modal

**What went wrong:** `NotifyModal.astro` and `LegalModal.astro` called `.focus()` on the close button immediately after `showModal()`. This triggered `:focus-visible` and showed the brand-red focus ring on the X button every time a modal opened.

**Why:** `element.focus()` in JS is treated as a potential keyboard-initiated focus by browsers (they can't always distinguish), so `:focus-visible` fires. `showModal()`'s own auto-focus has slightly different (browser-specific) heuristics.

**Rule:** When opening any modal, call `dialog.focus()` immediately after `showModal()` (where the dialog has `tabindex="-1"`) — never leave the browser to auto-focus the first control, and never focus `.modal-close`/`.popup-close`. Focusing a `tabindex="-1"` element keeps focus contained without showing the close-button ring on open. Keyboard users who Tab into the modal still get the correct ring. Add `outline: none` to the dialog element as a guard and add a regression test for any popup that opens automatically.

## Lock recurring footer and noindex cursor behavior with tests

**What went wrong:** Footer show links and noindex cursor behavior were reintroduced by later changes after already being fixed.

**Why:** The expected behavior was documented in conversation but not protected close enough to the data/layout code.

**Rule:** Footer Shows must stay capped at five city links plus one `/cities` All Cities link, the footer Explore list must not include `/links`, and `noindex` pages must not render or enable the custom cursor. Add or update regression tests whenever touching these areas.

## Removing `unsafe-inline` from CSP breaks Astro island hydration

**What went wrong:** PR #121 externalized GTM, PostHog and Meta Pixel scripts and tightened CSP by removing `unsafe-inline` from `script-src`. The apply form stopped working: the React island skeleton rendered but never mounted. The browser blocked Astro's hydration bootstrap because Astro generates inline scripts at build time for island registration and the component runtime.

**Why:** Astro's island hydration depends on inline `<script>` tags it injects at build time. These are framework internals — they cannot be externalized to a `.js` file. Without `unsafe-inline`, every Astro `client:only` island silently fails to mount. The error is not obvious: the page renders server HTML correctly, only client interactivity is dead.

**Rule:** On this site, `script-src` CSP must keep `unsafe-inline` permanently because of Astro island hydration. The correct tightening strategy is to externalize third-party scripts (GTM, PostHog, Meta Pixel) into `public/js/` files — which PR #121 did successfully — and add their domains to the CSP allow-list. Do not remove `unsafe-inline` from `script-src` without first migrating away from Astro islands entirely.

## Review the active PR stack before broad production rewrites

**What went wrong:** I initially framed the analytics/performance cleanup too narrowly, even though several open PRs were already part of a broad rewrite stack.

**Why:** On a stacked rewrite, narrow local patches can duplicate prior work or miss the durable shared layer the user actually needs.

**Rule:** For broad analytics, conversion, SEO, or performance work, inspect the active/open PR stack first, then make sustainable shared-system improvements that build on it. Do not default to the smallest patch when the user explicitly asks for the durable rewrite path.

## NEVER remove 'unsafe-inline' from script-src in the CSP

<!-- Hey, we never want to remove this lesson. Astro's island hydration breaks without unsafe-inline and the apply form will silently become a forever-skeleton. -->

**What went wrong:** PR #121 removed `'unsafe-inline'` from `script-src` in `vercel.json` to harden the CSP. This immediately broke the apply form — the skeleton stayed forever and the React component never mounted.

**Why 'unsafe-inline' is non-negotiable here:** Astro's island hydration system generates two inline `<script>` tags at build time that it cannot externalize: the `astro:only` runtime bootstrap and the `<astro-island>` component registration script. Both are inlined in every HTML page. Without `'unsafe-inline'` in `script-src`, the browser blocks them silently, the React island never hydrates, and any `client:only="react"` component (apply form, admin, contestant portal) becomes a dead skeleton.

Astro SSG cannot use nonces (requires a server per request) and cannot hash these scripts (they change every build). `'unsafe-inline'` is the only viable option for this static architecture.

The real XSS guards on this site are Firebase security rules and Firestore field-level validation, not the CSP. The meaningful CSP work from PR #121 (externalizing GTM, PostHog, and Meta Pixel as allowlisted external scripts) is preserved and stays.

**Rule:** Do not remove `'unsafe-inline'` from `script-src` in `vercel.json` unless Astro introduces a CSP-compatible static build mode. Their experimental nonce feature is server-rendered only. Check https://docs.astro.build/en/guides/content-security-policy/ before touching this.

## Client-side error handlers must not show raw browser exceptions to users

**What went wrong:** A contestant hit `net::ERR_NETWORK_CHANGED` mid-submit on `/contestant-portal` (a wifi/cellular handoff), and the UI showed the literal string "Failed to fetch" as the on-screen error, instead of the site's written fallback copy.

**Why:** `ContestantPortal.tsx`'s catch blocks did `err instanceof Error ? err.message : fallback`. Both a curated server error (`throw new Error(responseErrorMessage(...))`) and a raw browser `TypeError` from a failed `fetch()` satisfy `instanceof Error`, so the technical message won every time a request failed before reaching the server. The same fetches also had no timeout, so a hung request left the "Loading..."/"Completing..." state stuck forever (the same class of bug fixed for the apply form in `useApplyForm.ts` on 2026-07-07, but never carried over to the contestant portal).

**Rule:** When a catch block chooses between a curated message and a fallback, never gate on `instanceof Error` — it's true for both. Throw a dedicated error subclass (e.g. `PortalApiError`) only for messages that were authored for display, and treat every other exception as "show the fallback copy." Any fetch that can leave a user-facing loading/submitting state open must carry an `AbortController` timeout so it always resolves.

## jsdom fires click events on disabled buttons and they bubble to parent handlers

**What went wrong:** A new AdminDashboard test clicked a disabled card delete button to prove the single-flight guard blocks a second write. All 1095 tests passed, but vitest reported an unhandled rejection: the click bubbled to the card's `onClick`, mounted `ApplicantModal`, and the modal's `onSnapshot` subscription hit a Firestore mock that didn't define `onSnapshot`.

**Why:** Real browsers suppress click events on disabled form controls entirely, so nothing bubbles. jsdom (via fireEvent) dispatches the MouseEvent regardless, and React's root delegation runs ancestor handlers. The test therefore exercised a code path (card click opening the modal) that cannot happen in production, and the failure surfaced as an unhandled rejection attributed to the wrong test.

**Rule:** Any test file whose interactions could mount `ApplicantModal` (directly or via a bubbled click on a card) must include `onSnapshot` in its `firebase/firestore` mock, returning an unsubscribe no-op. More generally: clicking a disabled element in jsdom still bubbles, so never treat "the button is disabled" as proof a parent handler cannot fire in tests.

## Journal city sections drifted because they bypassed events.ts

**What went wrong:** Journal articles and the situationship masterclass showed "Tickets and dates" for Jersey City (last show already passed) and listed Seattle (no show at all) while Philadelphia and Washington DC, which had tickets on sale, never appeared. A related latent bug: about 40 articles stored `cityLinks` as `"/cities/x"` paths instead of bare slugs, so `getCityBySlug()` returned undefined and their city section silently never rendered.

**Why:** The sections were built from hand-maintained data (a hardcoded city array on the masterclass, the static `city.status` field and per-article `cityLinks` on the dynamic page) instead of deriving state from `src/data/events.ts`. Hand-maintained "tickets on sale" claims go stale the moment the events data changes.

**Rule:** Any surface that pairs a city name with ticket availability must derive that state from `src/utils/cityEvents.ts` (`isUpcomingEvent`, `getUpcomingEventsForCity`, `citySlugsWithUpcomingEvents`), never from `city.status`, hardcoded lists or copy. Curated lists are only allowed for waitlist/internal-link entries, and slugs in data files are always bare (`"manhattan"`, never `"/cities/manhattan"`).

## Security-rules changes must be tested against every client operation in the flow

**What went wrong:** PR #115 locked photo reads in `storage.rules` to admins only (correct: applicant photos are PII). The apply flow calls `getDownloadURL()` right after uploading, as the anonymous applicant. That call is a READ, so every submission threw `storage/unauthorized` before the Firestore write, and every applicant from July 7 to July 13 was lost. The PR comment even asserted the apply flow was unaffected because applicants "only write."

**Why:** `getDownloadURL()` does not feel like a read when writing the upload code, but rules treat it as one. Nothing in the toolchain connected the rules change to the client call: unit tests mock Firebase entirely, smoke tests mock the network layer and the rules deploy is a manual `firebase deploy` disconnected from CI. The breakage was structurally invisible before production.

**Rule:** Any change to `firestore.rules` or `storage.rules` must keep `npm run test:rules` green: emulator tests in `test/rules/` that execute the REAL client operations of the affected flows (upload, `getDownloadURL`, delete, document create/read). When adding a new client Firebase call, add it to those tests in the same PR. Remember: `getDownloadURL()` and `getBlob()` are reads; `deleteObject()` needs its own `allow delete` (a combined `write` rule that touches `request.resource.size` always denies deletes because `request.resource` is null).

## Weekly error digests cannot page you about a dying form, and third-party noise buries the signal

**What went wrong:** The apply-form outage above sat in PostHog error tracking for a week. The weekly digest that finally surfaced it was dominated by `window.webkit.messageHandlers` TypeErrors that are not site code at all: Instagram/Facebook in-app browsers inject their own scripts into every page and those crash constantly, so the one real `form_submission` error per lost applicant drowned in dozens of injected-script errors.

**Why:** The global error handler captured every `window` error as a site error, and no channel existed that alerts on the first failed submission. In-app-browser scripts are injected inline, so `event.filename` equals the page URL and an origin check cannot identify them; only message signatures can.

**Rule:** Revenue-critical failures (apply submissions) must page in real time through a first-party channel (`/api/alert-failure` email path), never only through an analytics SDK that ad blockers and in-app browsers routinely block. Known injected-webview errors (`window.webkit.messageHandlers`, "Java object is gone", `iabjs://` sources, bare "Script error." without a stack) are captured as `third_party_error`, never as `client_error`, so first-party issues stay readable. Do not delete the noise; reroute it.

## Critical flows must not live inside third-party embeds

**What went wrong:** The July 7 CSP hardening allowlisted known scripts but nobody knew /waiver depended on `form.jotform.com`, so the embed was blocked and the waiver page showed a spinner forever for six days. Nothing alerted: the failure happened inside a third-party iframe loader where no first-party code runs.

**Why:** A third-party embed is invisible to every safeguard this site has. CSP changes cannot know about it unless it is documented, error tracking cannot see inside it, and failure paging cannot be wired into it. The dependency also was not needed: the native waiver form and the `/api/stage-waiver` endpoint already existed for the contestant portal.

**Rule:** Legal and revenue flows (waiver signing, applications, lead capture, payments) must be first-party pages posting to first-party endpoints, never third-party embeds. When a third-party script is genuinely required, adding its host to the CSP allowlist and a smoke test that asserts the script actually loads are part of the same PR that introduces it.

## Diagnose production against the DEPLOYED config, never the repo's

**What went wrong:** The apply-outage analysis concluded "every application since July 7 failed" by assuming the #115 security rules were deployed when they merged. Production disproved it: submissions kept working because the rules deploy never happened. The real failure was #110's client-side 15 MB cap outrunning the still-deployed 5 MB storage rule, losing only large-photo applicants. Meanwhile the undeployed #115 rules meant the PII lockdown everyone believed was live was not.

**Why:** Rules, CSP headers and env ship on different pipelines than code (manual Firebase CLI vs automatic Vercel), so repo history says nothing about what production enforces. Every conclusion drawn from "PR X merged on date Y" inherited that false assumption.

**Rule:** Before stating a production root cause, verify the live artifact directly: curl the deployed headers, exercise the deployed rules with a real probe, or read the deployed config via API. A repo diff plus a merge date is a hypothesis, not evidence. The rules-drift check (scripts/check-rules-drift.mjs, every 6 hours) now makes the rules half of this automatic; the same discipline applies manually to headers and env.

## A hooks path that points at generated files silently disables every quality gate

**What went wrong:** Six broken tests and a dependency regression reached GitHub across seventeen commits with zero local gate failures. `core.hooksPath` pointed at `.husky/_`, a gitignored directory that husky generates during `npm install`. Session worktrees are provisioned without running install, so the directory did not exist and git silently ran no hooks at all: no lint-staged, no astro check, no vitest, no reviewer chain, no Verified check. Everything switched on mid-session as a side effect of an unrelated `npm install`, which is why late commits hit blocks that early commits never saw.

**Why:** Git treats a missing hooks directory as "no hooks configured" without any warning, and the hook scheme depended on a generated artifact existing in every worktree. The gates were all correctly written; they were never invoked.

**Rule:** Hooks must be checked-in, executable files (`.husky/` with shebangs), never generated ones. The repo-local `core.hooksPath` stays UNSET so the global `~/.git-hooks` chain (which runs the `.husky` hooks itself) governs; husky is removed because its installer re-points `core.hooksPath` at the generated `.husky/_` on every install, recreating the bypass. When diagnosing "how did this get past the hooks," first verify hooks RAN (`git config core.hooksPath` and that the target exists in the current worktree) before reading a single hook line.

## The entire pre-commit gauntlet was silently skipped for a week

**What went wrong:** Commits from fresh checkouts and worktrees ran zero gates: no prettier, no astro check, no vitest, no AI reviewers. A commit with unreviewed data changes landed on a PR branch with nothing but a one-line hint from git. The pipeline had been dead for those checkouts since Jul 5 and nobody noticed because a skipped hook prints a hint and exits 0.

**Why:** `.husky/pre-commit` and `.husky/pre-push` were committed with file mode 100644. Git refuses to run non-executable hook files and treats that as advisory (a "hint"), not an error. Checkouts where someone had run `chmod +x` locally kept working, which masked the bug: the same commit could be gated on one machine and ungated on another. The chmod never made it into the index, so every fresh checkout and worktree was born ungated.

**Rule:** Hook files must be committed with the executable bit (`git ls-files -s .husky/` must show 100755 for every hook). After adding or editing any hook file, verify with that command, not with `ls -l` on your own checkout. A gate that can be skipped silently is not a gate: if a hook is ever observed printing "ignored because it's not set as executable", treat it as a broken-build incident, not a hint.

## Vercel Speed Insights silently broke: NODE_ENV forced to development in prod

**What went wrong:** The Speed Insights dashboard showed "No data available. Make sure you are using the latest @vercel/speed-insights package." even with live traffic, while Vercel Analytics kept working fine.

**Why:** `astro.config.mjs` had a top-level `vite.define` hardcoding `process.env.NODE_ENV` to `"development"`, which text-replaces the value across every build, including production. `@vercel/speed-insights` reads `process.env.NODE_ENV` to pick its collector script and, seeing `"development"`, loaded the debug script (`script.debug.js`), which only console-logs and never reports vitals. Vercel Analytics was unaffected because `inject({ mode: "production" })` forces its own mode and bypasses NODE_ENV; `injectSpeedInsights` has no such override. The define started as a dev-only `optimizeDeps.esbuildOptions.define` shim (PR #14) and was promoted to a top-level `vite.define` during the Astro 7/Vite 8 upgrade (PR #61), silently making it apply to production too. It also meant React shipped and ran in development mode in production.

**Rule:** Never hardcode `process.env.NODE_ENV` in a top-level `vite.define`. Vite/Astro already set it correctly per build mode. If a dependency truly needs a dev-only NODE_ENV shim, scope it to `optimizeDeps.esbuildOptions.define`, never the top-level `define`, and verify the built output doesn't reference `*.debug.js` third-party scripts.

## The tracked "Get Tickets" redirect stalled 5 to 10 seconds twice, for two different causes

**What went wrong:** Visitors reported the same symptom, "nothing happens for 5 to 10 seconds after tapping Get Tickets", on two separate occasions five months apart. The first time (2026-08-14, fixed by PR #196) an embedded Eventbrite checkout widget silently failed inside Instagram's in-app browser, stalled, then fell back to a same-tab navigation. The second time (2026-08-27) `src/pages/api/go/[slug].ts`, the very route PR #196 built to replace the widget, was itself blocking its 302 response on an unbounded Redis rate-limit check plus a Meta CAPI call, and the one CTA that lands on that route in the same tab (`EventTicketCta.astro`, the page paid ads land on) gave zero visual feedback while it waited.

**Why:** Both times the actual bug was a network-dependent step placed where a visitor's redirect/checkout hop had to wait on it, and both times the same-tab CTA had no loading state to mask the wait while it lasted. Fixing the underlying network call each time (widget removal, then backgrounding the tracking calls via `waitUntil()`) closed that occurrence but never touched the missing-feedback half of the pattern, so the identical user-facing symptom was free to recur under a third cause.

**Rule:** Any checkout/redirect hop with a network dependency must satisfy both conditions, not just one: (1) the dependency never gates the response the visitor is waiting on, and (2) the click that starts the hop renders instant visual feedback (loading state, spinner, label change) independent of how fast the backend actually responds. Shipping only the backend fix leaves the UI blind to any future regression in that backend; shipping only the loading state leaves a slow backend un-fixed. Before closing out a "the button feels broken" report, verify both halves are true, not just the one that matches the immediate root cause found.
