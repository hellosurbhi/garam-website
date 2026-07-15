# Bugs

<!-- Doc routing (2026-07-13): this file is an OPEN backlog only. It holds
bugs not yet fixed, deferred or blocked items with their reason, and won't-fix
or resolved-by-design decisions (kept so the same report is not re-filed).
When a bug is fixed, DELETE its entry here in the same commit and record the
fix in CHANGELOG.md (plus LESSONS.md when the fix was non-obvious). Never add
fixed entries, [x] checkboxes or "Status: Fixed" records to this file. -->

## Open

### [HIGH] Dev server cannot transform TypeScript in astro component scripts

- **Date:** 2026-07-05
- **File:** any `.astro` file with TypeScript inside a `<script>` tag (HomeSignup, NotifyModal, index and more)
- **Status:** Open for remaining files (CookieConsent fixed 2026-07-05; upstream Astro/Vite Rolldown issue remains open)
- **Severity:** High (dev only; production builds are unaffected)
- **What happened:** In `npm run dev`, the `vite:oxc` transform parses extracted astro scripts as plain JavaScript, so any TypeScript syntax (a `type` import specifier, `as` casts, non-null `!`) throws `[PARSE_ERROR]` and the script module 500s. Pages render but their client scripts never execute, which makes features look broken in dev while working fine in the built site.
- **Fix pattern (proven on CookieConsent):** extract logic to a plain `.ts` module imported via Vite's normal TS pipeline; keep the inline `<script>` as a bare import with zero TS syntax. Sweep the remaining affected files if the upstream Astro/Vite Rolldown fix does not land.

### [LOW] Popup CTA copy still uses weaker pre-audit wording

- **Date:** 2026-04-08
- **File:** `src/pages/index.astro`
- **Status:** Blocked on business decision (2026-07-05): no final offer exists yet. Tracked in ENHANCEMENTS.md under "Strengthen popup offer copy once the actual incentive is finalized".
- **Severity:** Low
- **What's happening:** The popup still says "Want Cheaper Tickets?" and "Get My Discount Code" rather than the stronger offer-based copy proposed in the audit.
- **What should happen:** Popup copy should use the updated conversion-focused wording once the actual offer is confirmed.
- **Fix:** Replace the popup headline, supporting copy, and CTA with the finalized offer language.

### [LOW] CSP uses unsafe-inline weakening XSS protection

- **Date:** 2026-04-04
- **File:** `vercel.json`
- **Status:** Open
- **Severity:** Low
- **What's happening:** Both script-src and style-src include 'unsafe-inline', weakening CSP XSS protection.
- **What should happen:** Since the site is SSG, nonces do not apply; hashes do. Migrate to Astro's `experimental.csp` support, which computes hashes for inline scripts and styles at build time, then move the Content-Security-Policy header out of `vercel.json` so there is one source of truth.
- **Fix:** Dedicated PR (2026-07-05 triage decision): the migration touches every page's inline scripts and needs its own smoke-test pass, so it stays out of batch fixes. Read the LESSONS.md entry on `unsafe-inline` and Astro island hydration first: PR #121 already broke the apply form once by removing it, so any migration must prove the two Astro hydration inline scripts are hashable before shipping.

## Deferred

### [MEDIUM] Home creators avatars were not upgraded to larger host photos

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeCreators.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout"; decide sizing fresh in the redesign. Note if revisited: `hosts/wyatt.avif` source is 269x290, which caps avatars at about 160px before visible upscaling.

### [MEDIUM] Hosts page still uses small individual avatar images

- **Date:** 2026-04-08
- **File:** `src/pages/hosts.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout".

### [MEDIUM] Experience section photo placement was missed

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeExperience.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout".

### [MEDIUM] Testimonials accent photo was not added

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeTestimonials.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout".

### [MEDIUM] Journal decorative cupid artwork not implemented

- **Date:** 2026-04-08
- **File:** `src/pages/journal/index.astro`, `src/pages/journal/[slug].astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout". The `ai-art/cupid-garden.webp` asset exists and remains unused.

## Won't fix and resolved by design

### [MEDIUM] Home hero photo background from audit not implemented

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeHero.astro`
- **Status:** Won't fix (2026-07-05)
- **Severity:** Medium
- **What happened:** Owner directive: the hero is intentional and stays as designed (shader plus gradient). No photo layer will be added.

### [LOW] Leads collection allows unauthenticated phone updates

- **Date:** 2026-04-09
- **File:** `firestore.rules:45`
- **Status:** Resolved by design (2026-07-03)
- **Severity:** Low
- **What happened:** Confirmed intentional. The step-2 phone capture runs from the browser without auth — the caller needs the Firestore doc ID returned by `/api/capture-lead` to reach this path. Added a comment to `firestore.rules` explaining the design and the mitigation (doc ID as implicit ownership proof, field-only restriction).

### [LOW] Contact email usage is still inconsistent across pages

- **Date:** 2026-04-08
- **File:** `src/pages/faq.astro`, `src/pages/links.astro`
- **Status:** Resolved by design
- **Severity:** Low
- **What happened:** `contact@garammasaladating.com` is the canonical public contact (schema, legal, socials, llms.txt, FAQ footer). `press@garammasaladating.com` is intentionally used only in press/partnership-specific contexts (FAQ collaboration answer, links page press section). The two-inbox model is deliberate.

### Door time calculation can produce timestamp after show start time

- **File:** `src/utils/eventSchema.ts`
- **Source:** CodeRabbit PR #12
- **Status:** Resolved (no bug present)
- **Comment:** `subtractMinutes(start, 30)` computes `h * 60 + m - 30` with `Math.floor` — always produces a time 30 minutes before start. No clamping logic exists that could produce a later time. The referenced behavior does not reproduce in the current implementation.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384028

### [MEDIUM] Admin restore/participated handlers discard their async promise

- **Date:** 2026-07-13
- **File:** `src/components/admin/AdminDashboard.tsx:290,295`
- **Source:** DeepSeek 20260713-142719
- **Status:** Resolved (no bug present)
- **Comment:** `handleRestore` and `handleParticipated` are async but their `ApplicantCard` callers are typed `() => void`, so the returned promise is discarded. Not a live bug: `handleUpdate` catches every write error internally and surfaces a toast, so the discarded promise can never reject. The handlers also wrap in try/finally for the pending-state cleanup.

### [MEDIUM] Journal countdown heading for position 4 has no rankedItems entry

- **Date:** 2026-07-13
- **File:** `src/data/journal/pop-culture-dating.ts:681`
- **Source:** DeepSeek 20260713-173257
- **Status:** Disproven (2026-07-13), do not auto-fix
- **Comment:** No such article exists; the post at that location is `dating-shows-south-asians-all-ranked` and its `rankedItems` array has all 7 contiguous positions. The countdown tests in `src/data/journal.test.ts` verify heading/position correspondence on every commit and pass.

### [MEDIUM] WaiverPanel ResizeObserver never re-observes a changed child

- **Date:** 2026-07-13
- **File:** `src/components/WaiverPanel.tsx`
- **Source:** DeepSeek 20260713-175426
- **Status:** Resolved by design (2026-07-13)
- **Comment:** `observer.disconnect()` in the effect cleanup drops every observed target per spec (no leak), and the child is the `WaiverDocument` article rendered from a compile-time constant, so its identity never changes within a mount.

### [MEDIUM] WaiverPanel handleScroll recreated each render

- **Date:** 2026-07-13
- **File:** `src/components/WaiverPanel.tsx`
- **Source:** DeepSeek 20260713-175426
- **Status:** Resolved by design (2026-07-13)
- **Comment:** React delegates synthetic events at the root; a new handler identity per render does not re-register DOM listeners. Wrapping in useCallback would add noise with no behavior change.
