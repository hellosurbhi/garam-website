# Lessons

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

## The entire pre-commit gauntlet was silently skipped for a week

**What went wrong:** Commits from fresh checkouts and worktrees ran zero gates: no prettier, no astro check, no vitest, no AI reviewers. A commit with unreviewed data changes landed on a PR branch with nothing but a one-line hint from git. The pipeline had been dead for those checkouts since Jul 5 and nobody noticed because a skipped hook prints a hint and exits 0.

**Why:** `.husky/pre-commit` and `.husky/pre-push` were committed with file mode 100644. Git refuses to run non-executable hook files and treats that as advisory (a "hint"), not an error. Checkouts where someone had run `chmod +x` locally kept working, which masked the bug: the same commit could be gated on one machine and ungated on another. The chmod never made it into the index, so every fresh checkout and worktree was born ungated.

**Rule:** Hook files must be committed with the executable bit (`git ls-files -s .husky/` must show 100755 for every hook). After adding or editing any hook file, verify with that command, not with `ls -l` on your own checkout. A gate that can be skipped silently is not a gate: if a hook is ever observed printing "ignored because it's not set as executable", treat it as a broken-build incident, not a hint.

## Security-rules changes must be tested against every client operation in the flow

**What went wrong:** PR #115 locked photo reads in `storage.rules` to admins only (correct: applicant photos are PII). The apply flow calls `getDownloadURL()` right after uploading, as the anonymous applicant. That call is a READ, so every submission threw `storage/unauthorized` before the Firestore write, and every applicant from July 7 to July 13 was lost. The PR comment even asserted the apply flow was unaffected because applicants "only write."

**Why:** `getDownloadURL()` does not feel like a read when writing the upload code, but rules treat it as one. Nothing in the toolchain connected the rules change to the client call: unit tests mock Firebase entirely, smoke tests mock the network layer and the rules deploy is a manual `firebase deploy` disconnected from CI. The breakage was structurally invisible before production.

**Rule:** Any change to `firestore.rules` or `storage.rules` must keep `npm run test:rules` green: emulator tests in `test/rules/` that execute the REAL client operations of the affected flows (upload, `getDownloadURL`, delete, document create/read). When adding a new client Firebase call, add it to those tests in the same PR. Remember: `getDownloadURL()` and `getBlob()` are reads; `deleteObject()` needs its own `allow delete` (a combined `write` rule that touches `request.resource.size` always denies deletes because `request.resource` is null).

## Weekly error digests cannot page you about a dying form, and third-party noise buries the signal

**What went wrong:** The apply-form outage above sat in PostHog error tracking for a week. The weekly digest that finally surfaced it was dominated by `window.webkit.messageHandlers` TypeErrors that are not site code at all: Instagram/Facebook in-app browsers inject their own scripts into every page and those crash constantly, so the one real `form_submission` error per lost applicant drowned in dozens of injected-script errors.

**Why:** The global error handler captured every `window` error as a site error, and no channel existed that alerts on the first failed submission. In-app-browser scripts are injected inline, so `event.filename` equals the page URL and an origin check cannot identify them; only message signatures can.

**Rule:** Revenue-critical failures (apply submissions) must page in real time through a first-party channel (`/api/alert-apply-failure` email path), never only through an analytics SDK that ad blockers and in-app browsers routinely block. Known injected-webview errors (`window.webkit.messageHandlers`, "Java object is gone", `iabjs://` sources, bare "Script error." without a stack) are captured as `third_party_error`, never as `client_error`, so first-party issues stay readable. Do not delete the noise; reroute it.

## Critical flows must not live inside third-party embeds

**What went wrong:** The July 7 CSP hardening allowlisted known scripts but nobody knew /waiver depended on `form.jotform.com`, so the embed was blocked and the waiver page showed a spinner forever for six days. Nothing alerted: the failure happened inside a third-party iframe loader where no first-party code runs.

**Why:** A third-party embed is invisible to every safeguard this site has. CSP changes cannot know about it unless it is documented, error tracking cannot see inside it, and failure paging cannot be wired into it. The dependency also was not needed: the native waiver form and the `/api/stage-waiver` endpoint already existed for the contestant portal.

**Rule:** Legal and revenue flows (waiver signing, applications, lead capture, payments) must be first-party pages posting to first-party endpoints, never third-party embeds. When a third-party script is genuinely required, adding its host to the CSP allowlist and a smoke test that asserts the script actually loads are part of the same PR that introduces it.
