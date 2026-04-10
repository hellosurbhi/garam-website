# Changelog

## fix(tickets): remove cityMode from generic city-request modal (2026-04-10)

### What changed

Removed `cityMode={true}` from the "Request Your City" `LeadCaptureModal` on the tickets page. The trigger button had no `data-open-modal-city` attribute, so the hidden city input was never populated and city data was silently dropped from every lead captured through this flow.

### Files affected

- `src/pages/tickets.astro`

### Why

The modal was telling users "Tell us where you are" but never recording a city. The fix removes `cityMode` so the form works as a standard email lead capture with `source="tickets-city-request"` for attribution. Identified via CodeRabbit PR #12 review.

---

## triage: CodeRabbit PR #12 review resolved (2026-04-10)

### What changed

Triaged all 36 open CodeRabbit review threads on PR #12 (site rewrite). Replied to and resolved every thread.

### Files affected

- `BUGS.md` (11 new entries logged under "From PR #12 — Site Rewrite")
- `ENHANCEMENTS.md` (22 new entries logged under "From PR #12 — Site Rewrite")

### Summary

- 1 fix applied immediately (cityMode city capture bug)
- 11 tracked as bugs in BUGS.md (analytics corruption, security improvements, SEO regressions, quality gate)
- 22 tracked as enhancements in ENHANCEMENTS.md (a11y, copy-in-data, token usage, touch targets, etc.)
- 1 dismissed (intentional branding choice)

---

## analytics(tickets-notify): attribute lead source per city, document geo behavior (2026-04-10)

### What changed

Follow-up to the spice-list per-page attribution. The "Notify Me" flow for TBA events on `/tickets` (`src/components/NotifyModal.astro`, rendered there as `<NotifyModal source="tickets-notify" />`) used to submit every lead with a flat `source: "tickets-notify"`. Every city collapsed into one bucket even though the user had explicitly selected a city inside the modal, and `sourceCitySlug` (which already exists on the `LeadAttribution` type in `src/lib/leadAttribution.ts`) was never passed.

Now the source is composed per-city: `tickets-notify-<citySlug>` (e.g. `tickets-notify-manhattan`, `tickets-notify-san-diego`), and the same slug is forwarded as `sourceCitySlug` so both the flat source field and the dedicated slug field agree. The slug is taken from `EventEntry.citySlug` in `src/data/events.ts`, piped through a new `data-notify-city-slug` attribute on the TBA notify button, stashed in a hidden input when the modal opens, and read by both the email and phone submit handlers at send time.

Two small helpers landed inside the existing hoisted `<script>` in `NotifyModal.astro`:

- `toCitySlug(value)`: client-side fallback slugifier (lowercase, strip non-word, collapse whitespace into dashes, collapse repeat dashes) used only when a trigger button forgot to set `data-notify-city-slug`. Guarantees no future event ever writes a flat `tickets-notify` source.
- `composeSource(slug)`: returns `${baseSource}-${slug}` when slug is non-empty, falls back to `baseSource` otherwise.

The existing `const source = ...` in the modal script was renamed to `const baseSource = ...` so the distinction between the component-level prefix and the per-city composed value is obvious at every call site. Both submit handlers and the `notify_modal_opened` `trackLeadEvent` call now use `composeSource(citySlug)` consistently, and `trackLeadEvent("lead_phone_submitted", ...)` also carries the new `sourceCitySlug` field so PostHog sees the same shape as Firestore.

### Why the Firestore doc looked "sparse" on localhost

The work was triggered by a question: after submitting a tickets-notify from `/tickets` on the dev server, the Firestore `leads` doc only contained `city`, `createdAt`, `email`, `landingPage`, `posthogDistinctId`, `referrerHost`, `source`, `sourcePage`. No `geoCity` / `geoRegion` / `geoCountry` / `geoLatitude` / `geoLongitude` / `geoTimezone`. That is the expected behavior: `src/pages/api/geo.ts` reads Vercel's `x-vercel-ip-*` headers which only exist on the Vercel edge in production. On the local Astro dev server those headers are absent, `/api/geo` returns an object full of `undefined`, `bootstrapGeoData()` in `src/lib/leadAttribution.ts` only writes a sessionStorage key when the corresponding field is truthy, and `buildLeadAttribution` only appends a geo field to the attribution when its sessionStorage key exists. Net result: localhost will never produce `geo*` fields on lead docs, period. Testing on a deployed preview URL will populate all six.

### Files affected

- `src/pages/tickets.astro`: added `data-notify-city-slug={event.citySlug}` on the TBA "Notify Me" button. Astro omits the attribute automatically when `citySlug` is undefined, so events missing a slug fall through to the runtime slugification path.
- `src/components/NotifyModal.astro`: added `<input type="hidden" id="notify-city-slug" />` alongside the existing `notify-city` input, added `toCitySlug` / `composeSource` helpers, renamed `source` to `baseSource`, threaded `citySlug` and `finalSource` through the email submit handler, phone submit fallback branch, and both `trackLeadEvent` calls (`notify_modal_opened` and `lead_phone_submitted`). Also forwarded `sourceCitySlug: citySlug || undefined` to `buildLeadAttribution` in both submit paths so the dedicated attribution field is populated.
- `ENHANCEMENTS.md`: new `## Lead Attribution Follow-ups (2026-04-10)` section with two deferred backlog items, both with full implementation steps, code snippets, and file lists so a future session can execute them without re-researching. The items are: (1) the geo fetch race condition in `bootstrapGeoData()` (fire-and-forget, can lose geo fields on fast submits), and (2) a dev-mode fallback for `/api/geo` so localhost lead docs stop looking sparse.

### Decisions and trade-offs

- **Why keep the `source="tickets-notify"` prop on `<NotifyModal>` instead of dropping it?** The modal is a generic, reusable component. Keeping the component-level base as a prefix means a future caller (e.g. a city page "notify me" card) can pass `source="city-notify"` and automatically get `city-notify-<slug>` without changing any shared code. The prefix is the component's identity; the slug is the per-instance detail.
- **Why stash the slug in a hidden input instead of a module-level variable or data attribute on the dialog?** Two reasons. First, it keeps the data-flow parallel to the existing `notify-city` display-name hidden input, so the submit handlers read both pieces of state from the same place. Second, a `<dialog>` element can be re-opened for a different city without a full remount, so persisting via DOM (not closure state) avoids subtle bugs where a stale slug from a previous open would leak into the next submission.
- **Why client-side slugification as a fallback instead of requiring every event to have `citySlug`?** The type in `src/data/events.ts` already marks `citySlug` as optional, and I did not want this change to also become a data-model enforcement change. The fallback guarantees analytics never regress to a flat source string even if a future event is added in a hurry without the slug. When the slug is present it wins, so production events keep their curated slugs (`manhattan`, `san-diego`) rather than getting re-derived into less readable ones.
- **Why defer the geo race condition and dev fallback to `ENHANCEMENTS.md` instead of bundling them?** The race-condition fix converts `buildLeadAttribution` to `async` and touches every lead form on the site plus the Vitest suite; that is a cross-cutting atomic change that deserves its own PR and its own commit boundary. The dev-mode `/api/geo` fallback is a developer-experience nicety, not a production bug. Bundling either with the per-city source fix would muddy the commit and make `git blame` harder. Both are captured in `ENHANCEMENTS.md` with full implementation instructions so no research gets repeated.
- **Why `citySlug || undefined` when forwarding to `buildLeadAttribution`?** `buildLeadAttribution` uses `if (params.sourceCitySlug)` before attaching the field to the attribution payload, so passing an empty string would already be harmless. Passing `undefined` explicitly makes the intent obvious at the call site and keeps the Firestore doc clean (no empty-string `sourceCitySlug` field).

## analytics(spice-list): attribute lead source per page the form was submitted from (2026-04-10)

### What changed

The Spice List signup (`src/components/home/HomeSignup.astro`) is rendered by `BaseLayout.astro` on every page, so it is effectively a shared/common component. Previously every submission was attributed with a single static `source: "spice-list"`, which meant Firestore `leads` records and PostHog `lead_email_submitted` / `lead_phone_submitted` events could not distinguish a homepage signup from an apply-page signup or a city-page signup. `sourcePage` already captured `window.location.pathname`, but the flat `source` field was what most of the downstream filters and funnels keyed off, so the page-level signal was effectively lost.

Now the component computes a page name at build time from `Astro.url.pathname` and produces a per-page source string in the form `spice-list-<pageName>`:

- `/` becomes `spice-list-home`
- `/apply` becomes `spice-list-apply`
- `/tickets` becomes `spice-list-tickets`
- `/cities/nyc` becomes `spice-list-cities-nyc`
- `/journal/bollywood` becomes `spice-list-journal-bollywood`

The derived value is written into a `data-lead-source` attribute on the `.spicelist` section element. The hoisted `<script>` reads that attribute once at module init and passes it into every `buildLeadAttribution({ source })` call and the `trackLeadEvent("lead_phone_submitted", { source })` call, replacing the three hardcoded `"spice-list"` literals.

### Files affected

- `src/components/home/HomeSignup.astro`: added frontmatter that derives `pageName` from `Astro.url.pathname` (strip leading/trailing slashes, replace internal `/` with `-`, fall back to `"home"` for root), composes `leadSource = \`spice-list-${pageName}\``, renders it as `data-lead-source`on the`.spicelist`section, and reads it in the script via`document.querySelector<HTMLElement>(".spicelist[data-lead-source]")?.dataset.leadSource`. Replaced three hardcoded `source: "spice-list"`references in the email submit, phone submit, and phone-tracking paths with`leadSource`.

### Decisions and trade-offs

- **Why compute in Astro frontmatter instead of deriving in the client script?** The page name is known at build time for every static page, so computing it once in Astro gives us a stable identifier that matches the rendered URL, is not affected by client-side history/SPA transitions, and lives alongside the markup it describes. Deriving from `window.location.pathname` in the script would work too but would duplicate normalization logic that Astro already handles via `Astro.url`.
- **Why a `data-*` attribute instead of a prop on the component?** Astro `<script>` tags are hoisted module scripts and cannot directly consume component props. The DOM data attribute is the canonical bridge from the server-rendered markup to the client script, and `.dataset.leadSource` gives us type-safe access without any JSON parsing or window globals.
- **Why `spice-list-<pageName>` instead of a new `sourcePageName` field?** The downstream analytics filters and Firestore queries already key off `source` as the primary dimension. Keeping the `spice-list-` prefix means existing `source STARTS WITH "spice-list"` queries still work, while appending the page name gives the per-page granularity we need without adding a new field that every consumer has to learn about.
- **Why join multi-segment paths with `-` (e.g. `cities-nyc`) instead of only the first segment?** A city landing page and the `/cities` index would otherwise collapse into the same source. Full-path-dash gives each unique URL a unique source string, and `sourceCitySlug` / `sourcePage` in the attribution payload remain available for finer slicing when needed.
- **Fallback to the bare `"spice-list"` string if the data attribute is missing.** Defensive only; the attribute is always rendered. Kept as a safety net so a future refactor of the markup cannot silently break lead attribution by dropping submissions on the floor.

## fix(apply): unbreak the apply form (skeleton stuck, page-wide back-click bug) (2026-04-10)

### What changed

Two fixes that made the apply page completely broken for users.

**Bug 1: Static skeleton never hides, real form never shows.**

Commit 4f28eaf added a static HTML skeleton to prevent footer flash on load, with a CSS rule meant to hide it once React mounts:

```css
.apply-main:has([data-apply-root]) .apply-skeleton {
  display: none;
}
```

The problem: Astro 6 auto-scopes every compound selector inside `<style>` blocks by appending a `data-astro-cid-*` attribute requirement. The `[data-apply-root]` element is rendered by React inside `<astro-island>`, so it never receives the scope attribute. The `:has()` check could never match, and the skeleton stayed visible forever. Users saw the "About You" header, empty field boxes, and non-interactive `<span>` pills ("For myself" / "For a friend") with no working form.

Fix: moved that one rule into a `<style is:global>` block at the top of `src/pages/apply.astro`. Global rules skip Astro's scoping pass, so both `.apply-main`, `.apply-skeleton`, and `[data-apply-root]` resolve against the real DOM regardless of where they were rendered. The rest of the skeleton styles stay scoped.

**Bug 2: Clicking anywhere on the apply page sent users backward in history.**

`src/components/ApplyPage.tsx` had `onClick={() => window.history.back()}` on the root `.page` div, with `e.stopPropagation()` on the inner `.container` as a containment hack. Any click that landed on padding, margin, or the area around the 640px-wide form triggered a back navigation. This was a pre-existing click-outside-to-dismiss pattern that does not belong on a form page. Removed both handlers. The explicit "Back" button in the header is the correct way to navigate back.

### Files affected

- `src/pages/apply.astro`: added `<style is:global>` block for the `.apply-main:has([data-apply-root]) .apply-skeleton` hide rule; removed the same rule from the scoped `<style>` block.
- `src/components/ApplyPage.tsx`: removed `onClick={() => window.history.back()}` from the root `.page` div and the now-unnecessary `onClick={(e) => e.stopPropagation()}` from the `.container` div.

### Decisions and trade-offs

- **Why `<style is:global>` instead of `:global(...)` per-selector?** Astro supports both, but a dedicated global block for the one rule is more explicit about intent. Future readers immediately see "this rule bridges scoped and unscoped DOM" without having to know `:global()` syntax. The class names `.apply-main` and `.apply-skeleton` are unique to this file, so there is no cross-file leakage risk.
- **Why remove `onClick={window.history.back}` entirely instead of scoping it?** There is no defensible reason for a form page to behave like a dismissable modal. The explicit "Back" button already exists and is the correct affordance. Click-outside-to-dismiss belongs on lightboxes and modals, not on multi-field forms where the user is mid-input.
- **The ErrorBoundary fallback (`src/components/ErrorBoundary.tsx`) does not render `[data-apply-root]`.** If React mounts and then throws, the skeleton will still be visible underneath the error UI. This is not actively broken (the error UI overlays correctly), but could be cleaned up later by adding `data-apply-root` to the fallback wrapper.

## content: purge all em dashes, en dashes, and double dashes from user-facing content (2026-04-10)

### What changed

Removed every em dash (—), en dash (–), and double dash (--) from user-facing content across the entire site. Em dashes are a dead giveaway for AI-generated content and Surbhi flagged them as "seeing em dashes everywhere." The only acceptable dash is a hyphen that is literally part of a compound word (e.g., `mobile-first`, `stand-up`, `co-host`).

**Replacement rules applied:**

- Em dash (—) in prose → comma, period, or colon depending on context
- Em dash (—) in titles (`Title — Subtitle`) → colon (`Title: Subtitle`) or pipe (`Title | Subtitle`) for schema names
- En dash (–) in numeric/price/time ranges → the word "to" (e.g., `20–30 seconds` → `20 to 30 seconds`, `$50k–$100k` → `$50k to $100k`)
- Attribution format (`\n— Author`) → bare author line

**Files changed (user-facing only; code comments deliberately untouched):**

- `src/data/copy.ts`: OG image alt text
- `src/data/journal/arranged-marriage.ts`, `bollywood.ts`, `caste-class.ts`, `community-deep-dives.ts`, `dating-culture.ts`, `entertainment.ts`, `events.ts`, `identity.ts`, `toxic-patterns.ts`: ~780 em dashes replaced with commas via bulk `sed` (all space-surrounded em dashes) plus en dashes in section headings (`Month 0–1` → `Month 0 to 1`, `Problems 1–5` → `Problems 1 to 5`).
- `src/components/ContestantPrepPage.tsx`: 9 em dashes across list items, arrival instructions, and inline prose; plus 2 en dashes in `20–30 seconds` / `30–60 second` ranges.
- `src/components/ApplyPage.tsx`: `Failed to load places — tap to retry` → `Failed to load places. Tap to retry.`
- `src/components/admin/AdminDashboard.tsx`: `{event.date} — {event.city}` → `{event.date}: {event.city}` in prep-row label.
- `src/components/admin/ApplicantModal.tsx`: `"—"` placeholder for empty timestamp → `"N/A"`.
- `src/components/home/HomeShows.astro`: `parseDay(event.date) !== "—"` → `parseDay(event.date) !== ""` to match the new sentinel value.
- `src/components/layout/PageNav.astro`: logo `aria-label="Garam Masala Dating — Home"` → `aria-label="Garam Masala Dating: Home"`.
- `src/utils/eventDate.ts`: `parseMonth()` and `parseDay()` return `""` instead of `"—"` for TBA/unparseable dates. Doc comments updated.
- `src/pages/hosts.astro`: page title, bio prose (`scene — a space`, `the show — and counting`, `best house party — except`), and credit spans (`Actor — ESPN+` → `Actor: ESPN+`).
- `src/pages/journal/index.astro`: empty-state message (`New essays coming soon — follow us` → `New essays coming soon. Follow us`).
- `src/pages/journal/[slug].astro`: mid-article CTA sentence (`for South Asian singles — weekly in NYC` → `for South Asian singles, weekly in NYC`).
- `src/pages/cities/[slug].astro`: hero ticket CTA `{event.date} — Get Tickets` → `{event.date}: Get Tickets`.
- `src/pages/corporate.astro`: JSON-LD service name `Private & Corporate Show — Garam Masala Dating` → `... | Garam Masala Dating`.
- `src/pages/sponsorship.astro`: JSON-LD service name `Brand Sponsorship — Garam Masala Dating` → `... | Garam Masala Dating`.
- `src/pages/llms.txt.ts`: upcoming-events list format string.
- `src/pages/llms-full.txt.ts`: testimonial attribution (`\n— ${author}` → `\n${author}`), every heading em dash (`## The Experience — Step by Step` → `## The Experience: Step by Step`, `### Surbhi — Co-Creator & Host` → `: Co-Creator & Host`, etc.), bio prose in embedded Surbhi/Wyatt bios, pressLine template, and the `22–40 age range` en dash.
- `src/lib/constants.ts`: video title `Garam Masala Dating — NYC's #1 Live...` → `Garam Masala Dating: NYC's #1 Live...`.
- `src/types/application.ts`: `INCOME_OPTIONS` en dashes (`$50k–$100k` etc.) → `$50k to $100k` etc.

**Also updated:**

- `CLAUDE.md`: Added the no-dashes rule to the "Never do" list as a non-negotiable. Also replaced every em dash in CLAUDE.md itself (most in the "Aesthetic choices" and "Never do" / "Environment variables" sections) with colons, because the file was dogfooding exactly the pattern being banned.
- `MEMORY.md`: Added a pointer to the new `feedback_no_dashes.md` entry. Replaced existing em dashes in the index with colons.
- Auto-memory: Created `feedback_no_dashes.md` with the full rule, replacement guidance, scope exceptions, and reasoning.

### Why

Em dashes are the single most obvious giveaway that copy was written or auto-polished by an LLM. Surbhi is going full-time with the show in 2026 and wants the voice on the site to read as distinctly human. Scrubbing every em/en dash in one sweep prevents drift and gives future sessions a codified rule to follow.

### Out of scope

- **Code comments and JSDoc blocks**: em dashes inside `//`, `/* */`, `/** */`, and HTML `<!-- -->` comments are untouched. They are never rendered to users and cleaning them adds noise to an already large diff.
- **Box-drawing characters** (`──`, U+2500) in section-separator comments: distinct from em dash (U+2014), left alone.
- **Test descriptions** inside `describe()` / `it()` strings: dev-only output, not user-facing.
- **En dashes in `.ts` test fixtures**: same reason.

### Decisions and trade-offs

- **Bulk sed vs. case-by-case edits for journal articles**: journal files contain ~780 prose em dashes. Replacing `" — "` (space em dash space) with `", "` as a bulk substitution produced grammatically sound results in every spot-checked case, because all em dashes in those files were mid-sentence parentheticals. Hand-editing 780 instances would have been slower and no better.
- **Colon vs. pipe for JSON-LD service names**: used `|` for schema.org service names (`Private & Corporate Show | Garam Masala Dating`) to match SEO title convention, and `:` elsewhere for prose-style titles.
- **"N/A" vs. blank for ApplicantModal placeholder**: chose `"N/A"` because the admin table column needs a visible value and blank would collapse the row height.
- **`parseDay`/`parseMonth` returning `""` instead of `"—"`**: the sentinel value is an implementation detail. Switching to empty string is the cleanest fix since it lets the existing TBA fallback branch in `HomeShows.astro` handle the empty case without a magic em-dash literal.

## polish: homepage detail pass: animations, tokens, focus parity (2026-04-10)

### What changed

A final detail-level polish pass on the `cleanup-enhancements-to-the-new-ui` branch. Zero padding/spacing/color/typography changes; zero content or section-reorder changes. Every commit is either an animation upgrade, a token swap that resolves to the same hex, or a keyboard-parity enhancement.

**Commits in this pass (newest first):**

1. `74f9fd4` — `a11y(home): focus-visible parity on five keyboard-interactive elements` — each already had a richer `:hover` treatment than the global red outline alone; tacked `:focus-visible` onto the same selectors so keyboard users get the same feedback. Elements: `.exp-cta-link`, `.creators-cta-link`, `.press-name`, `.video-facade .play-icon`, `.spicelist-skip`.
2. `7671061` — `style(stats): animate stat counters with count-up on scroll` — `IntersectionObserver` triggers a 1500ms easeOutCubic tween on each `.stat-num` when the stats section enters viewport. Parses raw text into target + suffix (e.g. `"2K+"` → 2 with `"K+"`) so source-of-truth stays in `src/data/copy.ts`. Reduced-motion short-circuits the entire observer.
3. `9070b97` — `style(faq): smooth expand/collapse with height transition` — intercepts `<summary>` clicks to animate `.faq-answer` height between 0 and `scrollHeight` over 300ms cubic-bezier, with a `void el.offsetHeight` layout flush to guarantee the start frame is committed before the end frame. Native `<details>` remains the no-JS + reduced-motion fallback.
4. `66841a1` — `style(reveal): stagger [data-reveal] children in wave-like cascade` — new stagger pre-pass in the `IntersectionObserver` in `src/pages/index.astro` walks every `[data-reveal-stagger]` parent and sets `style.transitionDelay = i * 60ms` on each `[data-reveal]` child, producing a 480ms cascade tail. Applied to `.shows-list`, `.testi-grid`, `.faq-list`. Existing `prefers-reduced-motion` guard already disables it.
5. `18f03c8` — `style(modal): add exit animations to email popup and city modal` — shared `@keyframes popupOut` / `@keyframes modalOut` in `src/index.css`. Both vanilla `<dialog>` closers now route through a `closeWithExit` helper that adds a `.closing` class, listens for `animationend`, then calls native `close()`. Reduced-motion users skip the wait and get instant close.
6. `710d46b` — `style(shows): richer hover/focus state on show cards` — `.show-card:hover` and `.show-card:focus-within` share a treatment: subtle background tint, 4px rightward translate, and ticket-label letter-spacing + color shift. Transform is gated behind `@media (prefers-reduced-motion: no-preference)`.
7. `a1185f0` — `fix(modal): focus email input on open instead of dialog` — unrelated prior-session modal focus-ring fix committed separately (carried over from pre-polish work).
8. `d3e70aa` — `style(tokens): replace exact-match hardcoded colors with CSS vars` — `#fff0e2` → `var(--cream-warm)`, `#eee` → `var(--border-light)`, `#888`/`#666` → `var(--muted)`. Each swap resolves to the same hex (or within 3 units) so visually identical. Removed truly unused `--hover-subtle` token. `--cream`, `--text`, `--text-light`, `--border`, `--success` remain in place because admin components and `reactSelectStyles.ts` depend on them.
9. `b0a9f0a` — `refactor(style): extract shared .btn/.btn-hot/.btn-outline to index.css` — moved the complete button spec from `HomeHero.astro` scoped styles into the global `src/index.css` block. HomeHero renders byte-identical (same selectors, same rules, different file). Ready for future components to consume without re-defining.

### Intentionally out of scope

- **Hero section** — left untouched per the "don't touch the hero" rule.
- **Padding/margin/spacing values** — no values changed anywhere in the diff; every spacing number is intentional.
- **Font sizes, letter-spacing, line-height, color hex values** — no typographic or color changes, only refactors from hex-literal to equivalent-value CSS var.
- **Section reorder / section cuts** — Press stays, Video stays where it is, no content moves.
- **Section background colors** — unchanged; alternation rule still enforced.
- **Shared `.eyebrow` base class** — skipped. The hero eyebrow's glass-background styling is visually distinct enough that extracting a shared base would have required a modifier-and-override dance that adds more code than it removes. Each section eyebrow keeps its scoped style.
- **Shared `.faq-cta-btn` unification into `.btn btn-hot`** — skipped for the same reason; the FAQ CTA button uses `padding: 14px 32px` while the shared `.btn` uses `padding: 16px 24px`, and overriding the shared value to match would defeat the unification. The two rules stay separate since the shared base now exists for future consumers.
- **React → vanilla conversion** of ContestantPrepPage, **ApplyPage split**, **unified `Modal.astro`/`Modal.tsx` changes**, **hardcoded-text refactor to data files** — all deferred to separate PRs.

### Anti-regression guarantees

- Zero padding, margin, gap, width, or flex-basis values changed.
- Zero color hex values changed — only swapped for a CSS variable that resolves to the same value (or within 3 luminance units in one case, flagged in that commit).
- Zero font-family, font-size, letter-spacing, or line-height changes.
- `HomeHero.astro` touched only in commit `b0a9f0a` where the duplicated `.btn` block was removed — the output computes identically because the same rules now live in `src/index.css`.
- All new animations honor `prefers-reduced-motion: reduce`, either via the existing global rule at `src/index.css:208-216` or via runtime `matchMedia` guards in new script blocks.
- All new focus-visible states layer on top of (not replace) the global red outline.
- Pre-commit hook ran `astro check` (0 errors) and `vitest` (916/916 passing) on every commit.

### Files affected

```
src/index.css                                 (shared .btn + keyframes + token cleanup)
src/pages/index.astro                         (stagger pre-pass, popup exit animation)
src/components/home/HomeHero.astro            (remove duplicated .btn block only)
src/components/home/HomeShows.astro           (hover upgrade, city modal exit, stagger marker)
src/components/home/HomeStats.astro           (count-up animation)
src/components/home/HomeFAQ.astro             (smooth accordion, color + stagger marker)
src/components/home/HomeTestimonials.astro    (stagger marker)
src/components/home/HomeExperience.astro      (token swap, focus-visible parity)
src/components/home/HomeCreators.astro        (focus-visible parity)
src/components/home/HomePress.astro           (focus-visible parity)
src/components/home/HomeVideo.astro           (focus-visible parity)
src/components/home/HomeSignup.astro          (focus-visible parity)
```

## fix(modal): focus email input on open, remove red ring on X button (2026-04-10)

### What changed

When the LeadCaptureModal opened, the X close button received focus and displayed a red focus ring. Two things combined to cause it: (1) Chrome routes `showModal()` auto-focus to the first focusable child (the close button) before the explicit `dialog.focus()` call runs, and (2) the global `:focus-visible { outline: 2px solid var(--brand-red); }` in `index.css` then paints it red.

**Fix:** In `LeadCaptureModal.astro`, after `showModal()`, focus the email input directly instead of the dialog element. This means the close button never receives focus on open, and keyboard users get immediate access to the email field — better UX.

**Files changed:**

- `src/components/LeadCaptureModal.astro` — `dialog.focus()` → `dialog.querySelector("[data-lc-email]")?.focus()`
- `src/components/ui/Modal.astro` — updated JSDoc and script comment to reflect correct focus pattern

## fix: apply page footer flash on load (2026-04-10)

### What changed

The `/apply` page flashed the footer briefly before the form appeared. Every other page loads beautifully without this flash. The root cause: ApplyPage uses `client:only="react"` (required — uses Firebase, `window.history`, `crypto`, `navigator.modelContext`), so no form HTML ships in the initial response. Until React downloaded and hydrated, `<main>` was empty and the footer was visible at the top of the viewport.

**Fix:** ship a static HTML skeleton inside `apply.astro` that mirrors the form's above-the-fold layout — back button, title, subtitle, tab pills, "About You" section title, field boxes. The skeleton paints instantly (same as every other page). Once React mounts and renders `[data-apply-root]` inside the astro-island, CSS `:has()` hides the skeleton and the real form takes over seamlessly.

Also added `min-height: 100vh` to `.apply-main` (matching the pattern in `faq.astro:161` and `tickets.astro:271`) as a safety net.

**Why not refactor to `client:load`?** The SSR path would require SSR-proofing `analytics.ts`, `leadAttribution.ts`, `firebase.ts`, and configuring `react-select` for SSR — 4+ files with real risk of breaking analytics, Firebase init, or form submission across the whole site. The skeleton achieves the same visual goal with ~2% of the risk.

**Files affected:** `src/pages/apply.astro`, `src/components/ApplyPage.tsx`

## design-review: fix FAQ link styling and CSP Twitter pixels (2026-04-09)

### What changed

Design audit of garammasaladating.com found 8 issues, fixed 2.

**Fixed:**

- FAQ answer links ("casting form", "buy a ticket", etc.) rendered as default browser blue instead of brand-red. Root cause: Astro scoped styles don't reach `<a>` tags injected via `set:html`. Fix: use `:global(a)` in both `HomeFAQ.astro` and `faq.astro`.
- Twitter/X analytics tracking pixels blocked by Content-Security-Policy. The `img-src` directive was missing `https://t.co` and `https://analytics.twitter.com` — added both.

**Files affected:** `src/components/home/HomeFAQ.astro`, `src/pages/faq.astro`, `vercel.json`

**Design score:** B | **AI Slop score:** A | Full report: `.gstack/design-reports/design-audit-garammasaladating-2026-04-09.md`

## refactor: unified modal architecture with shared CSS tokens (2026-04-09)

### What changed

Introduced a single CSS token file (`modal-tokens.css`) as the source of truth for all modal design values. Both `Modal.astro` and the new `Modal.tsx` React base import it — changing `--modal-radius`, `--modal-anim-duration`, or any other token propagates to every modal automatically.

**New files:**

- `src/components/ui/modal-tokens.css` — defines `--modal-radius`, `--modal-anim-duration/easing/scale/y`, `--modal-close-color/size`
- `src/components/ui/Modal.tsx` — React base counterpart to `Modal.astro`; identical behavior (showModal, cancel event, backdrop click)
- `src/components/ui/Modal.module.css` — React base CSS, imports modal-tokens.css
- `src/components/apply/TermsModal.module.css` — extracted from ApplyPage.module.css

**Refactored:**

- `TermsModal.tsx` — now uses `Modal` base; removed manual overlay div, focus management, `open` prop; parent controls mounting
- `ApplicantModal.tsx` — now uses `Modal` base; removed `dialogRef`, `showModal` effect, cancel event effect, `handleDialogClick`
- `ApplyPage.tsx` — changed `<TermsModal open={...}>` to `{showTermsModal && <TermsModal ...>}`

**Bug fixed:** Close button focus ring on modal open. Three call sites all focused the close button instead of the dialog container:

- `TermsModal.tsx` — was calling `closeButton.focus()` via `requestAnimationFrame`
- `ApplicantModal.tsx` — native `<dialog>` auto-focused first focusable child (close button)
- `LeadCaptureModal.astro:317` — was calling `closeButton.focus()` explicitly

All three now call `dialog.focus()` after `showModal()`. The dialog container has `outline: none`, so no ring is visible. Tab still moves to the close button for keyboard users; touch users never see a ring.

**Close button CSS:** Added `:focus-visible` styles to all close buttons — focus ring appears for keyboard navigation only, suppressed for mouse/touch.

**Cleaned up:** Removed ~120 lines of dead terms modal CSS from `ApplyPage.module.css`.

**Files affected:** `modal-tokens.css`, `Modal.astro`, `Modal.tsx`, `Modal.module.css`, `LeadCaptureModal.astro`, `TermsModal.tsx`, `TermsModal.module.css`, `ApplyPage.tsx`, `ApplyPage.module.css`, `ApplicantModal.tsx`, `ApplicantModal.module.css`

## fix: address 9 CodeRabbit review items from PR #13 (2026-04-09)

### What changed

Resolved all 10 open CodeRabbit review threads on the site rewrite PR. 9 enhancements implemented, 1 dismissed (intentional MCP tool attributes).

**Tests:**

- `ContestantPrepPage.test.tsx`: Assert loading spinner before auth completes; enumerate all 13 prep questions instead of just 3.
- `generateContestantLink.test.ts`: Set `import.meta.env.SITE` to a custom origin and assert the URL uses it.

**Content architecture:**

- Extracted gallery photo data from `HomePhotos.astro` into `src/data/gallery.ts` (heading, subheading, photo array).

**Code quality:**

- `HomePhotos.astro`: Replaced inline `style={object-position}` with CSS custom property `--photo-pos`.
- `LegalModal.astro`: Replaced hardcoded `white` with `var(--off-white)`; set `font-size: 16px` on legal links for iOS zoom prevention.
- `ApplyPage.tsx`: Hardened `navigator.modelContext` guard to verify `registerTool` is callable before invoking.
- `HomeShows.astro`: Moved `searchCities()` call inside `try` block so fetch failures show the modal error UI.

### Files changed

- `src/data/gallery.ts` (new)
- `src/components/home/HomePhotos.astro`
- `src/components/LegalModal.astro`
- `src/components/ApplyPage.tsx`
- `src/components/home/HomeShows.astro`
- `src/components/ContestantPrepPage.test.tsx`
- `src/lib/generateContestantLink.test.ts`
- `ENHANCEMENTS.md`

## feat: build /corporate and /sponsorship pages with full SEO (2026-04-09)

### What changed

Two new permanent SEO-catch pages targeting high-intent B2B queries.

**`/corporate` — Private & Corporate Events:**
Hero → Book a Show CTA → caleb@garammasaladating.com. Show format + 3 audience size tiers (Intimate 50–100, Mid-Size 100–175, Full House 175–250). "What's Included" 2×2 grid: Hosts, Production, Venue, Post-Show Mixer. 3 corporate testimonials. FAQ accordion.

**`/sponsorship` — Brand Partnerships:**
Media Kit stat grid (250/show, 10M+ views, 70%+ South Asian, 40+ shows). 4 sponsorship tiers with pricing: Presenting ($3K–$5K), Gold ($1.5K–$2.5K), Silver ($500–$1K), In-Kind. Target sponsor categories. FAQ accordion. CTA → partnerships@garammasaladating.com.

**SEO on both pages:** BreadcrumbList + FAQPage + SpeakableSpecification JSON-LD. Service JSON-LD on /corporate. Keyword-targeted titles and descriptions. Footer links, sitemap 0.8 priority, LLM file entries.

### Files created

- `src/data/corporate.ts`, `src/data/sponsorship.ts`
- `src/pages/corporate.astro`, `src/pages/sponsorship.astro`

### Files modified

- `src/data/footer.ts` — replaced `Brand Partnerships → mailto` with `Corporate Events → /corporate` and `Sponsorship → /sponsorship`
- `astro.config.mjs` — added `corporate|sponsorship` to 0.8 sitemap priority
- `src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts` — added both pages

### Decisions

- All copy in data files — zero text hardcoded in components
- Presenting tier uses charcoal bg for visual hierarchy without new colors
- Corporate testimonials are representative placeholders — replace with real quotes as they come in

---

## feat: add VideoObject, EventSeries, AggregateRating, and Speakable extension JSON-LD schemas (2026-04-09)

### What changed

Added four new JSON-LD schema types across `index.astro` and `tickets.astro` to improve AI/LLM discoverability and Google Rich Results coverage.

**`src/pages/index.astro`**

- Added `VideoObject` schema pointing to the YouTube highlight reel (`AXDhphHBUj4`) with thumbnailUrl, contentUrl, embedUrl, uploadDate, duration, and publisher
- Added `EventSeries` schema with `@id` anchor (`#event-series`), repeatFrequency `P2W`, location (Top Secret Comedy Club), and performer array with CREATOR_URLS
- Extended `orgJsonLd` (Organization) with `aggregateRating` (ratingValue: 5, ratingCount: 3) and `review` array built from live TESTIMONIALS data — name extracted via comma-split for "Priya, 27" → "Priya"
- Extended `speakableJsonLd` cssSelector to include `.hero-sub` (hero description) alongside FAQ selectors
- Imported `CREATOR_URLS`, `TESTIMONIALS`, `YOUTUBE_VIDEO_ID`, `VIDEO_METADATA`

**`src/lib/constants.ts`**

- Added `VIDEO_METADATA` export (title, description, uploadDate, duration) — TODOs inline to verify against YouTube Studio before launch

**`src/utils/eventSchema.ts`**

- Added `superEvent` field to each Event output, linking back to the EventSeries via `@id` anchor

**`src/pages/tickets.astro`**

- Added same `EventSeries` JSON-LD (inlined, no shared utility needed — only two pages use it)

### Why

VideoObject lets Google/AI index the highlight video without watching it. EventSeries signals recurring nature so search engines don't treat each show as a one-off. AggregateRating + Review surface star ratings in SERPs. Speakable extension on `.hero-sub` gives voice assistants the show description as a readable snippet.

### Files affected

- `src/pages/index.astro`
- `src/pages/tickets.astro`
- `src/lib/constants.ts`
- `src/utils/eventSchema.ts`

## feat: add WebMCP tool annotations to all public forms (2026-04-09)

### What changed

Added Web Model Context Protocol (WebMCP) progressive enhancement to all public-facing forms. WebMCP (Chrome 145+, W3C incubation) lets AI agents discover and invoke HTML forms as tools. Zero impact on regular users — attributes are invisible on unsupported browsers.

**Declarative API (HTML/Astro forms)** — added `toolname`, `tooldescription`, and `toolparamdescription` attributes:

- `src/components/home/HomeSignup.astro` — `#nl-email-form` (`subscribe-to-spice-list`) + `#nl-phone-form` (`add-phone-to-spice-list`)
- `src/components/home/HomeShows.astro` — `#city-form` (`request-show-in-my-city`)
- `src/components/NotifyModal.astro` — `#notify-form` (`subscribe-to-ticket-drop-alerts`) + `#notify-phone-form` (`add-phone-to-ticket-alerts`)
- `src/pages/cities/[slug].astro` — `#waitlist-form` (`join-city-show-waitlist`), `#city-notify-email-form` (`subscribe-to-city-show-alerts`), `#city-notify-phone-form` (`add-phone-to-city-show-alerts`)
- `src/pages/index.astro` — `#popup-email-form` (`subscribe-via-homepage-popup`) + `#popup-phone-form` (`add-phone-via-homepage-popup`)

**Imperative API (React island):**

- `src/components/ApplyPage.tsx` — registers `submit-contestant-application` tool in a `useEffect` via `navigator.modelContext.registerTool()`. Full inputSchema covers applicationType, fullName, age, gender, sexualOrientation, city, instagram. Cleans up with `tool.unregister()` on unmount. Feature-detects `modelContext` in navigator — no-op on unsupported browsers.

**Skipped:** Admin login — internal-only, no AI agent exposure needed.

### Files modified

- `src/components/home/HomeSignup.astro`
- `src/components/home/HomeShows.astro`
- `src/components/NotifyModal.astro`
- `src/pages/cities/[slug].astro`
- `src/pages/index.astro`
- `src/components/ApplyPage.tsx`

### Decisions + trade-offs

- Declarative `toolname`/`tooldescription` on `<form>` elements lets the browser build JSON Schema automatically from input types and `required` constraints
- `toolparamdescription` on individual inputs gives AI agents context for what value to provide
- Imperative API used for the React apply form (client island, no traditional `form action`) — `useEffect` + feature detection is the correct pattern
- `NavWithMC` local type avoids `any` while typing the draft browser API that has no official TypeScript declarations

---

## fix: exclude .stryker-tmp from ESLint (2026-04-09)

### What changed

`eslint.config.js` — added `.stryker-tmp` to `globalIgnores`. Stryker mutation testing creates sandboxes in `.stryker-tmp/` that include auto-generated files with `@ts-nocheck`, `any` types, and `var` declarations. ESLint was picking these up and failing `npm run lint` with ~100 false-positive errors in test sandbox files that are already in `.gitignore`.

### Files modified

- `eslint.config.js`

### Decisions

- `.stryker-tmp` is already in `.gitignore` — it should have been in `globalIgnores` from the start. This is the correct fix rather than adding `// eslint-disable` to generated files we don't control.

---

## feat: AI/LLM discoverability — llms.txt, AEO schema, sitemap optimization (2026-04-09)

### What changed

Full AEO (Answer Engine Optimization) pass: gave AI crawlers, LLMs, and RAG systems everything they need to understand and cite Garam Masala Dating accurately.

**robots.txt — AI crawler permissions:**

- Added 6 missing AI crawlers: `OAI-SearchBot`, `Applebot-Extended`, `CCBot`, `Meta-ExternalAgent`, `cohere-ai` (all `Allow: /`), `Bytespider` (`Disallow: /` — low-quality scraper)
- Added `Sitemap: https://garammasaladating.com/sitemap-index.xml` and `Sitemap: https://garammasaladating.com/llms.txt` entries

**llms.txt and llms-full.txt — dynamic Astro endpoints:**

- `src/pages/llms.txt.ts` — concise AI index, generated at build time from data files. Includes upcoming shows (live from `events.ts`), active city pages, FAQ short answers (HTML-stripped), 20 most-recent journal titles, all tips post titles, and stats
- `src/pages/llms-full.txt.ts` — comprehensive content dump for large-context AI systems. Includes full FAQ long answers, complete host bios, all experience steps, upcoming + past shows with venue details, active city pages with body paragraphs, all 3 tips posts in full body text, 12 most-recent journal posts in full body text + FAQs, remaining journal posts as title + excerpt, press, and all socials
- Both files regenerate on every deploy from `src/data/` — no manual maintenance
- Static `public/llms.txt` and `public/llms-full.txt` removed (replaced by endpoints)

**Speakable JSON-LD — voice assistant targeting:**

- `src/pages/faq.astro` — added `WebPage` + `SpeakableSpecification` with `cssSelector: [".faq-answer-text"]`. Targets actual DOM class on FAQ answer paragraphs
- `src/pages/index.astro` — added `WebPage` + `SpeakableSpecification` with `cssSelector: [".faq-answer-summary", ".faq-answer-detail"]`. Targets HomeFAQ answer classes. Tells Google Assistant, Siri, Alexa which text to read when answering "what is Garam Masala Dating?"

**Sitemap priority + lastmod:**

- `astro.config.mjs` — added `serialize` callback to `@astrojs/sitemap` integration
- Priority: homepage `1.0` → tickets/apply/faq/hosts `0.8` → content indexes `0.7` → journal/tips posts `0.6` → default `0.5` → city pages `0.4`
- `lastmod`: journal posts use `dateModified` from post data; tips posts use `dateModified` from post data; all other pages use build timestamp
- Imports `journalPostsPublished` and `tipPosts` at config load time to build a URL→Date map

**Strategy documentation:**

- `seo-article-strategy.md` — added Category 9 (AEO) covering: how AI systems discover content, why `llms.txt` accelerates entity recognition, implementation status table, content requirements for `llms-full.txt`, the "garam masala" disambiguation problem, and an AEO query target table with 7 high-priority queries
- `ENHANCEMENTS.md` — marked `llms.txt` as done, added AEO context to the IMDb/Wikidata entity recognition items, explained the remaining gap (Wikidata = most important unfinished AEO item)

### Files created

- `src/pages/llms.txt.ts`
- `src/pages/llms-full.txt.ts`

### Files modified

- `public/robots.txt`
- `src/pages/faq.astro`
- `src/pages/index.astro`
- `astro.config.mjs`
- `seo-article-strategy.md`
- `ENHANCEMENTS.md`

### Files deleted

- `public/llms.txt` (replaced by endpoint)
- `public/llms-full.txt` (replaced by endpoint)

### Decisions + trade-offs

- Used real CSS class names for Speakable selectors (`.faq-answer-text`, `.faq-answer-summary`, `.faq-answer-detail`) instead of adding new wrapper classes — Speakable silently ignores selectors that match nothing, making wrong class names a silent failure
- `llms-full.txt` includes full body text for top 12 published journal posts and falls back to title + excerpt for the rest — balances comprehensiveness with the 100KB size target
- Importing TypeScript data files directly in `astro.config.mjs` works because Astro's config is processed through Vite, which handles TypeScript natively

---

## fix: address CodeRabbit PR #13 review comments (2026-04-09)

### What changed

Worked through all 16 unresolved CodeRabbit threads on the cleanup PR. 13 fixed, 2 dismissed (already handled or intentional), 1 dismissed with explanation.

**Security (generate-contestant-link.ts):**

- Wrapped `request.json()` in try/catch — returns 400 on malformed JSON instead of 500
- Replaced `Host` header URL construction with `import.meta.env.SITE` to prevent host-header spoofing

**Lead attribution (leadAttribution.ts):**

- Moved `GEO_FETCHED_KEY` write to after the successful geo API response — previously set before the fetch, which permanently blocked retries on network failures
- Note: `geoLatitude`/`geoLongitude` are intentionally kept (geo enrichment is a deliberate product feature)

**SSR safety (useApplyForm.ts):**

- Added `typeof window !== 'undefined'` guards before `window.history`, `window.location.search`, and `window.location.pathname` accesses to prevent ReferenceError during SSG pre-render

**Accessibility:**

- `aria-hidden="true"` added to all decorative SVG close icons (HomeShows, LegalModal, cities/[slug], index)
- `aria-hidden="true"` added to all decorative arrow SVGs in city CTA buttons
- `required` added to city name input in HomeShows request form
- `loading="lazy"` added to hero background image in cities/[slug].astro
- `aria-describedby` linked to existing error elements on waitlist and notify form inputs

**Config:**

- Separated ESLint and Prettier lint-staged patterns — ESLint only runs on TS/JS files (no Astro plugin configured), Prettier covers all source files including `.astro`

**Typo:**

- Fixed "Intructions for:" → "Instructions for:" in `ContestantPrepPage.tsx` and its test

### Files affected

- `src/pages/api/generate-contestant-link.ts`
- `src/lib/leadAttribution.ts` + `.test.ts`
- `src/components/apply/useApplyForm.ts`
- `src/components/home/HomeShows.astro`
- `src/components/LegalModal.astro`
- `src/pages/index.astro`
- `src/pages/cities/[slug].astro`
- `src/components/ContestantPrepPage.tsx` + `.test.tsx`
- `package.json`

### Decisions

- `geoLatitude`/`geoLongitude` kept: intentionally added for Firebase lead enrichment
- `client:load` on apply.astro kept: SSR guards added to the hook instead
- "Close" aria-label and "Last updated:" prefix not moved to data layer: generic UI chrome, not content

## fix: codebase audit — verifyToken env var, prerender flags, dead code cleanup (2026-04-09)

### What changed

Deep-dive codebase audit with targeted non-breaking fixes.

**Bug fix — generate-contestant-link was broken:**

- `src/lib/verifyToken.ts` used `process.env.VITE_FIREBASE_PROJECT_ID` which doesn't exist in `.env.local`. Changed to `import.meta.env.PUBLIC_FIREBASE_PROJECT_ID` to match the rest of the codebase. This was causing the admin contestant link endpoint to silently reject all requests.

**Missing prerender flags on API routes:**

- Added `export const prerender = false;` to `city-search.ts`, `contestant-prep-auth.ts`, `notify-application.ts`, `generate-contestant-link.ts`. Without this, the GET endpoint (`city-search`) was being prerendered as static JSON at build time.

**Dead code removal:**

- Deleted `src/lib/citySearchShared.ts` — identical duplicate of functions in `citySearch.ts`, only imported in tests. Updated test imports to use `citySearch.ts` and exported `normalize()`.
- Moved `src/pages/api/city-search.test.ts` to `test/` — Astro was treating it as a page route, breaking builds.

**Code quality:**

- Replaced `StylesConfig<any>` with proper `BaseStyles` type in `reactSelectStyles.ts`
- Added `console.error` to silent `.catch(() => {})` blocks in `useApplyForm.ts` and `leadAttribution.ts` for observability

**Logged for later:**

- 3 security issues added to BUGS.md (Firestore unauthenticated writes, no input validation on POST routes, leads phone update rule)
- 10 enhancement items added to ENHANCEMENTS.md (large components, hardcoded colors, media queries, !important, error tracking, eslint security plugin, etc.)

### Files affected

- `src/lib/verifyToken.ts` — env var fix
- `src/lib/verifyToken.test.ts` — updated test env var references
- `src/pages/api/city-search.ts` — prerender flag
- `src/pages/api/contestant-prep-auth.ts` — prerender flag
- `src/pages/api/notify-application.ts` — prerender flag
- `src/pages/api/generate-contestant-link.ts` — prerender flag
- `src/lib/citySearch.ts` — exported `normalize()`
- `src/lib/citySearchShared.ts` — deleted
- `src/lib/citySearchShared.test.ts` — updated imports
- `test/city-search.test.ts` — moved from `src/pages/api/`
- `src/utils/reactSelectStyles.ts` — removed `any` type
- `src/components/apply/useApplyForm.ts` — error logging
- `src/lib/leadAttribution.ts` — error logging
- `BUGS.md` — 3 new security entries
- `ENHANCEMENTS.md` — 10 new enhancement entries

### Decisions

- Only implemented non-breaking changes that won't affect UI or functionality
- Security issues (Firestore rules, input validation, CSP) logged in BUGS.md for separate review since they could affect form submission behavior
- Component refactoring logged in ENHANCEMENTS.md since it's larger-scope work

## feat: PostHog full free tier integration + Firebase geo metadata (2026-04-09)

### What changed

Enabled every free PostHog feature and added comprehensive click tracking across the site. Fixed missing geolocation metadata on all Firebase lead documents.

**PostHog features enabled:**

- Session replay (5K recordings/month) with PII masking on all email/phone inputs
- Heatmaps (click maps, scroll depth, rage click detection)
- Dead click detection (tappable-looking elements that aren't interactive)
- Pageleave tracking (time-on-page for every pageview)
- Web Vitals capture (LCP, CLS, FCP, INP)
- Autocapture with copied text detection
- Admin/contestant-prep pages excluded from tracking

**Click tracking added:**

- `cta_clicked` events on all CTAs (Get Tickets, Apply, Notify Me, Request City) with section context
- `nav_clicked` events on navigation pills (HomeNav + PageNav)
- `outbound_link_clicked` for all external links (Eventbrite, social, press) with domain classification
- `faq_opened` tracking which FAQ questions users expand
- `video_played` when YouTube facade is clicked
- `apply_form_started` for apply form funnel (started → submitted)
- Centralized via delegated `[data-ph-capture]` listener in BaseLayout (fires to both PostHog + GTM)

**Firebase geo metadata fix:**

- New `/api/geo` endpoint reads Vercel's IP geolocation headers
- `leadAttribution.ts` fetches + caches geo data in sessionStorage on page load
- All Firebase lead documents now automatically include `geoCity`, `geoRegion`, `geoCountry`, `geoLatitude`, `geoLongitude`, `geoTimezone`
- Zero changes needed in individual form handlers — attribution pipeline handles it

### Files changed

- `src/pages/api/geo.ts` — NEW (Vercel geo headers endpoint)
- `src/lib/leadAttribution.ts` — added geo fields, fetch + cache logic
- `src/components/posthog.astro` — full PostHog config with all free features
- `src/layouts/BaseLayout.astro` — delegated click + outbound link trackers
- `src/components/home/HomeHero.astro` — CTA tracking attributes
- `src/components/home/HomeNav.astro` — nav tracking attributes
- `src/components/layout/PageNav.astro` — nav tracking attributes
- `src/components/home/HomeExperience.astro` — CTA tracking attributes
- `src/components/home/HomeFAQ.astro` — CTA attributes + faq_opened tracking
- `src/components/home/HomeShows.astro` — show card tracking + ph-mask on city-email
- `src/components/home/HomeVideo.astro` — video_played tracking
- `src/pages/tickets.astro` — ticket card tracking attributes
- `src/pages/links.astro` — primary CTA tracking attribute
- `src/components/apply/useApplyForm.ts` — apply_form_started event
- `src/pages/index.astro` — ph-mask on popup inputs
- `src/components/home/HomeSignup.astro` — ph-mask on newsletter inputs
- `src/components/NotifyModal.astro` — ph-mask on notify inputs
- `src/pages/cities/[slug].astro` — ph-mask on waitlist/city inputs

### Decisions

- Used `data-ph-capture` data attributes + a single delegated listener instead of scattering `posthog.capture()` calls across every component. Centralized, maintainable, and fires to both PostHog AND GTM via existing `trackLeadEvent()`.
- `person_profiles: 'identified_only'` conserves event quota by only creating person profiles when `identifyLead()` is called (email submission), not for every anonymous visitor.
- Geo data fetched once per session via `/api/geo` (Vercel edge headers), cached in sessionStorage. Non-blocking fire-and-forget fetch so it doesn't delay page load.
- `.ph-mask` class on PII inputs ensures session replay masks email/phone values.

## test: kill surviving mutants + city-search API tests (2026-04-09)

### What changed

Added ~54 targeted tests to kill specific surviving Stryker mutants across 9 existing test files, plus a new 11-test suite for the `src/pages/api/city-search.ts` API endpoint (previously 0% coverage).

Key mutant-killing patterns:

- **Operator boundaries**: exact city (1000) vs label (950) score hierarchy, descending vs ascending sort assertions, `>=` vs `>` boundary tests
- **String literals**: exact offset values ("-04:00", "-05:00"), exact error messages, Content-Type headers
- **Conditional branches**: isSelected precedence over isFocused in react-select, shouldLoad=false blocks fetch, pathname fallback to "/"
- **Return values**: `null` vs `undefined` for type checks, empty string UTM skipping, number type exclusion for posthogDistinctId

### Files changed

- 9 existing test files edited with targeted additions
- `src/pages/api/city-search.test.ts` — NEW (11 tests)

## test: comprehensive mutation-resistant tests for lib/, utils/, hooks/ (2026-04-08)

### What changed

Added 12 new test files and extended 3 existing test files to dramatically improve mutation testing coverage. Total: ~160 new tests covering every exported function in src/lib/, src/utils/, and src/hooks/.

**New test files:**

- `src/lib/phone.test.ts` — 17 tests covering all 5 branches with boundary values
- `src/lib/constants.test.ts` — 3 tests for constant values
- `src/lib/citySearchShared.test.ts` — 23 tests for normalize, search, resolve, scoring
- `src/lib/analytics.test.ts` — 13 tests for trackLeadEvent + identifyLead with window mock
- `src/lib/leadAttribution.test.ts` — 19 tests for bootstrap + build with sessionStorage/UTM
- `src/lib/citySearch.test.ts` — 14 tests for loadCityOptions caching + search/resolve
- `src/utils/breadcrumbs.test.ts` — 8 tests for JSON-LD schema generation
- `src/utils/locationDisplay.test.ts` — 3 tests for formatLocation branches
- `src/utils/eventDate.test.ts` — 15 tests for isEventPast guards + year heuristic + msUntilMidnight
- `src/utils/timezone.test.ts` — 8 tests for nyOffset EDT/EST/DST boundaries
- `src/utils/eventSchema.test.ts` — 19 tests for buildEventSchemas filtering + defaults + conditionals
- `src/hooks/useCitySearch.test.ts` — 10 tests for debounce, fetch, error, retry

**Extended test files:**

- `src/lib/verifyToken.test.ts` — +2 tests for cache behavior + issuer/audience verification
- `src/hooks/useGeoData.test.ts` — +4 tests for shouldLoad=false, retry, failed state
- `src/utils/reactSelectStyles.test.ts` — +22 tests for option state branches, exact color/padding values

### Decisions

- Used real timers (not fake) for useCitySearch to avoid waitFor/fakeTimer deadlock
- Used vi.resetModules() + dynamic import for citySearch.test.ts to reset module-level cache
- Mocked country-state-city, @/data/cities, @/utils/timezone, window.posthog, sessionStorage
- Cast minimal objects as Application type rather than mocking firebase/firestore

## Production cleanup + revenue infrastructure (2026-04-08)

**PostHog distinct ID fix** — Apply form now calls `identifyLead()` with Instagram handle before `trackLeadEvent('apply_submitted')`. Previously applicants stayed permanently anonymous in PostHog. Also added GTM dataLayer identification.
**Image reorganization** — Restructured `public/images/` from 19 loose files into organized subfolders: `hero/`, `hosts/`, `promo/`, `journal/`. Deleted redundant `hosts.JPG` (315KB, already had webp+avif). Updated all 15 source files with new paths.
**Unified modal system** — Created `ui/Modal.astro` (shared dialog chrome) and `LeadCaptureModal.astro` (reusable email→phone→success flow with configurable copy via props). Supports multiple instances per page, city mode, `data-open-modal` triggers.
**Email capture on every page** — Added `SpiceListSection.astro` above footer on all pages via BaseLayout. Added "Get on the List" as primary CTA on links page, "Don't see your city?" section on tickets page, inline "See [host] live" CTAs on hosts page, mid-article CTA banner on journal pages.
**Schema upgrades** — Event→ComedyEvent with performer, doorTime, maximumAttendeeCapacity. FAQPage schema on homepage. alternateName on Organization for entity disambiguation.
**AI discoverability** — Created `/llms.txt`. Updated `robots.txt` with 8 missing AI crawlers (OAI-SearchBot, Claude-SearchBot, Applebot-Extended, DuckAssistBot, Amazonbot, cohere-ai, meta-externalagent, Bytespider). Added `<link rel="alternate">` for llms.txt.
**CSS cleanup** — Replaced 13 hardcoded hex colors in ApplyPage.module.css with CSS variables. Added `--apply-brown`, `--border-light`, `--hover-subtle` tokens.
**Housekeeping** — Created `.env.example`. Merged `ENHANCEMENT.md` into `ENHANCEMENTS.md`. Created 1,307-line `ROADMAP.md` with full growth plan, research, and actionable roadmap.

- `src/components/apply/useApplyForm.ts`, `src/lib/analytics.ts` — PostHog fix
- `public/images/` — reorganized into subfolders (21 files moved)
- `src/components/ui/Modal.astro`, `src/components/LeadCaptureModal.astro`, `src/components/SpiceListSection.astro` — new
- `src/layouts/BaseLayout.astro` — SpiceListSection, llms.txt link
- `src/pages/links.astro`, `tickets.astro`, `hosts.astro`, `journal/[slug].astro` — email capture CTAs
- `src/utils/eventSchema.ts` — ComedyEvent schema
- `src/pages/index.astro` — FAQPage schema, alternateName
- `public/llms.txt`, `public/robots.txt` — AI discoverability
- `src/index.css`, `src/components/ApplyPage.module.css` — CSS variables
- `.env.example`, `ROADMAP.md`, `ENHANCEMENTS.md` — docs

## fix: phone accepts international numbers, apply form analytics, code cleanup (2026-04-08)

### What changed

**Phone handling rewritten** — replaced `normalizeUsPhone` (US-only, rejected everything else) with `cleanPhone` in `src/lib/phone.ts`. US 10-digit numbers auto-format to `+1XXXXXXXXXX`. International numbers with `+` prefix are stored with digits cleaned. Anything with 7+ digits is accepted. Nobody gets blocked. Error message softened to "Please enter a valid phone number." Placeholder updated from `+1 (555) 123-4567` to `(555) 123-4567` and aria-label from "Phone number (include country code)" to "Phone number" across all 4 forms.

**Apply form analytics** — added `trackLeadEvent('apply_submitted')` with `applicationType`, `city`, `country`, and full lead attribution to `useApplyForm.ts`. This was the only form without any PostHog/GTM tracking.

**Bug fixes:**

- `src/pages/cities/[slug].astro` — fixed try/catch indentation where `try` was nested inside `if (submitBtn)` but `catch` was at a different scope level
- `src/components/home/HomeSignup.astro` — removed `console.error` left in catch block (violates project rule)

**ENHANCEMENT.md** — added "Later Later" section with note on international phone input with country selector (packages like `react-phone-number-input`) for when we actually have international texting services.

### Files changed

- `src/lib/phone.ts` — rewritten (`normalizeUsPhone` → `cleanPhone`)
- `src/components/NotifyModal.astro` — import, placeholder, aria-label, error message
- `src/components/home/HomeSignup.astro` — import, placeholder, aria-label, error message, removed console.error
- `src/pages/index.astro` — import, placeholder, aria-label, error message
- `src/pages/cities/[slug].astro` — import, placeholder, aria-label, error message, try/catch indent fix
- `src/components/apply/useApplyForm.ts` — added analytics tracking on submit
- `ENHANCEMENT.md` — added Later Later section

---

## feat: redesign all email forms — first name, phone step, proper error handling (2026-04-07)

### What changed

**All four sign-up/notify forms** now share a consistent two-step flow with proper error handling, CLS prevention, and international phone support.

**Files affected:** `src/components/home/HomeSignup.astro`, `src/pages/index.astro` (popup), `src/pages/cities/[slug].astro` (city notify), `src/components/NotifyModal.astro`

**What changed in each:**

- Added first name input to step 1 (all forms previously only asked for email)
- Step 1 writes `{ firstName, email, source, createdAt }` to Firestore and stores `DocumentReference`
- Step 2 is an optional phone number step — uses `updateDoc(docRef, { phone })` to update the same doc (fallback: `addDoc` with full data if ref lost)
- Success state is only shown **after confirmed Firestore resolve** — never optimistically
- Network errors show inline error messages; skip button remains available on phone step failure
- Phone validation: strip autocorrect noise first (`replace(/[\s\-().]/g, '')`), then validate `/^\+\d{7,15}$/`; E.164 format required (+1...)
- CLS fix: steps wrapped in container with `min-height` (220–260px) so step 1→2 swap doesn't shift content below

**ENHANCEMENT.md:** Added full-site CLS audit documenting 13 instances (7 HIGH, 4 MEDIUM, 2 LOW) with specific files, triggers, and recommended fixes.

---

## fix: restore custom cursor, revert CodeRabbit padding regressions, fix shader pink (2026-04-07)

### What changed

**BaseLayout.astro:** Restored custom cursor (desktop-only, `pointer: fine` guard, `prefers-reduced-motion` accessibility guard). CodeRabbit had removed it in commit 7d30c7e. Cursor divs, JS animation loop, dark-section detection, and hover scale all restored. Added dialog observer so cursor moves inside `<dialog>` when modal is open.

**shader-app.js:** Removed `fluid = mix(fluid, vec3(1.0), 0.3)` — this line was mixing 30% white into all fluid colors, turning the DC2626 red pink/washed out.

**Section padding reverted** (CodeRabbit had increased all of these):

- `HomeStats.astro` desktop: `120px 48px` → `100px 48px`
- `HomeShows.astro` desktop: `80px 36px` → `75px 36px`
- `HomeShows.astro` mobile: `56px 16px` → `55px 16px`
- `HomePress.astro` desktop: `56px 48px` → `48px 48px`
- `HomePress.astro` mobile: `40px 20px` → `36px 20px`

**HomeSignup.astro:** Fixed `.spicelist-form button:hover` to use `white` background (was incorrectly changed to `charcoal/black`).

**CLAUDE.md:** Added "Aesthetic choices — intentional, never revert" section documenting custom cursor, all padding/margin/gap values, color hex values, section backgrounds, font sizes/spacing, and the $2k WebGL shader. Rule: CodeRabbit comments on these must be dismissed with "intentional design choice".

### Files changed

- `src/layouts/BaseLayout.astro`
- `public/js/shader-app.js`
- `src/components/home/HomeStats.astro`
- `src/components/home/HomeShows.astro`
- `src/components/home/HomePress.astro`
- `src/components/home/HomeSignup.astro` (hover fix)
- `CLAUDE.md`

---

## fix: revert shader logo, fix Firebase Auth CSP, Instagram post-load (2026-04-07)

### What changed

**shader-app.js:** Reverted `img.src` from `/images/logo.svg` back to the blank 1×1 SVG data URI. The CodeRabbit commit (7d30c7e) had replaced the placeholder with the real logo, causing it to appear as a white watermark in the hero background and making the fluid animation look washed out/pink. The blank SVG restores the pure red/yellow fluid look. The `maskDirty` performance improvement (don't upload texture every RAF frame) is preserved.

**vercel.json:** Added `https://identitytoolkit.googleapis.com` and `https://securetoken.googleapis.com` to `connect-src`. These are required for `signInAnonymously()` (Firebase Auth). Missing them caused the apply form to fail silently in production — the form appeared to submit but no data reached Firestore.

**HomeVideo.astro:** Instagram `embed.js` now loads via `requestIdleCallback` after `window.load` instead of waiting for scroll intersection. This means embeds are populated before the user scrolls to the reels section. LCP is unaffected because the load is deferred until after `window.load`.

### Files changed

- `public/js/shader-app.js`
- `vercel.json`
- `src/components/home/HomeVideo.astro`

## fix: address all remaining CodeRabbit PR #11 review comments (2026-04-07)

### What changed

Resolved all 15 unresolved CodeRabbit review threads on PR #11 (13 fixed, 2 dismissed).

**Fixes:**

- **scripts/optimize-images.js:** Missing source images now fail the run with non-zero exit instead of silently succeeding under VERBOSE-only logging.
- **ApplicantModal.tsx:** Guarded `showModal()` against already-open dialogs and jsdom environments. Added `aria-labelledby` linking dialog to applicant name heading. Made photo preview keyboard-accessible with `role="button"`, `tabIndex`, and Enter/Space handling.
- **ApplicantModal.module.css:** Replaced hardcoded `32px` and `rgba(0,0,0,0.5)` with new `--dialog-gutter` and `--backdrop` CSS tokens in `:root`.
- **useApplyForm.ts:** Fixed age validation gap where non-numeric input (`"abc"`) passed validation because `NaN < 18` is `false`.
- **ApplyPage.module.css:** Renamed `@keyframes toastIn` to `toast-in` for stylelint kebab-case. Added 48px touch targets to `.termsLink` and `.toastDismiss`. Replaced undefined `var(--font-heading)` with `var(--font-playfair)`.
- **HomeVideo.astro:** Added unique `aria-label` per Instagram embed link. Added guard for missing `data-youtube-id`.
- **PageNav.astro:** Initialized scroll state on page load (previously only updated after first scroll event).
- **posthog.astro:** Removed invalid `defaults: '2026-01-30'` PostHog init option.
- **index.css:** Added `--dialog-gutter: 16px` and `--backdrop: rgba(0,0,0,0.5)` tokens to `:root`.

**Dismissed:**

- BaseLayout.astro custom cursor — already removed in commit 7d30c7e.
- organize-images.js `import.meta.dirname` — package.json already requires `>=20.11.0`.

**Files affected:** `scripts/optimize-images.js`, `src/index.css`, `src/components/admin/ApplicantModal.tsx`, `src/components/admin/ApplicantModal.module.css`, `src/components/apply/useApplyForm.ts`, `src/components/ApplyPage.module.css`, `src/components/home/HomeVideo.astro`, `src/components/layout/PageNav.astro`, `src/components/posthog.astro`

## perf: YouTube facade + lazy-load Instagram embed.js on scroll (2026-04-07)

### What changed

- **YouTube:** restored facade pattern (thumbnail → iframe on click). Uses the real YouTube play button SVG instead of a text ▶ character. iframe only loads when tapped/clicked — saves ~600KB on page load.
- **Instagram:** `embed.js` (200KB) now deferred via Intersection Observer — only injected into the DOM when the reels row scrolls within 200px of the viewport. On bounce/quick visits, it may never load at all.

**Files affected:** `src/components/home/HomeVideo.astro`

## fix: popup email error feedback + HomeVideo background distinction (2026-04-07)

### What changed

- `src/pages/index.astro`: popup email form catch block was silently swallowing all errors. Added `#popup-email-error` element to markup, wired it in the catch block, added `.popup-error` style.
- `src/components/home/HomeVideo.astro`: changed background from `var(--off-white)` to `white` so the "See What You're Missing" section is visually distinct from the Creators section above it (both were `#FFF8F0`).

## feat: real YouTube iframe + Instagram embeds with fallbacks (2026-04-07)

### What changed

Replaced facade/link pattern with real embeds throughout, with proper fallbacks.

**YouTube:** switched from click-to-load facade back to always-visible `<iframe>`. Fallback link (thumbnail + play icon) sits behind the iframe via `z-index`; visible only if the iframe fails to load.

**Instagram:** `blockquote.instagram-media` embeds with `embed.js`. The `<a>` inside each blockquote is the native Instagram fallback if the script doesn't execute.

**Files affected:** `src/components/home/HomeVideo.astro`

## feat: restore Instagram reel embeds + fix CSP for YouTube, Instagram, pixels (2026-04-07)

### What changed

Restored Instagram blockquote embeds (removed in previous session for perf) and fixed all CSP violations blocking video/embed content.

**HomeVideo.astro:** reverted Instagram reels from link buttons back to `blockquote.instagram-media` embeds with `embed.js` script. Removed dead `.reel-link` CSS, added `.reel-embed` centering styles.

**vercel.json CSP additions:**

- `script-src`: `https://www.instagram.com` (embed.js), TikTok, Twitter pixels
- `frame-src`: `https://www.instagram.com`, `https://www.youtube-nocookie.com`, `https://vercel.live`
- `img-src`: `https://i.ytimg.com`, `https://www.instagram.com`, `https://*.cdninstagram.com`, `https://*.fbcdn.net`
- `connect-src`: `https://us-assets.i.posthog.com`, TikTok, Instagram

**Files affected:** `src/components/home/HomeVideo.astro`, `vercel.json`

## fix(csp): allow YouTube thumbnails, YouTube player, TikTok, Twitter pixels (2026-04-07)

### What changed

Updated CSP in `vercel.json` to unblock previously broken features:

- `img-src` + `https://i.ytimg.com` — YouTube thumbnail was being blocked
- `frame-src` + `https://www.youtube-nocookie.com` — YouTube player iframe was blocked on click
- `frame-src` + `https://vercel.live` — Vercel dev toolbar was blocked
- `script-src` + `https://analytics.tiktok.com` + `https://static.ads-twitter.com` — GTM-injected pixels were blocked
- `connect-src` + `https://us-assets.i.posthog.com` + `https://analytics.tiktok.com` — PostHog source maps and TikTok network requests blocked

**Files affected:** `vercel.json`

## fix: CodeRabbit PR #11 review — a11y, error handling, touch targets, data (2026-04-07)

### What changed

Two atomic commits addressing all actionable CodeRabbit review comments on PR #11.

**Touch targets (48px minimum)**

- `index.astro` popup: close/dismiss/skip buttons from 4px → full 48px hit area
- `HomeNav.astro`: logo link gets `min-height: var(--touch-target)`
- `PageNav.astro`: added `:focus-visible` outline to pill links
- `HomeFooter.astro`: desktop social icons 32px → 48px
- `cities/index.astro`: region nav jump links min-height 48px
- `cities/[slug].astro`: modal close button and "Maybe later" skip button both 48px

**Contrast / ARIA**

- `HomeCreators.astro`: subtitle opacity 0.5 → 0.7; bio text 0.6 → 0.75 (WCAG AA)
- `404.astro`: canvas gets `aria-hidden="true"`; footer legal links get contrast override

**Error handling**

- `HomeSignup.astro`: email step shows inline error on Firestore failure; no longer silently advances
- `cities/[slug].astro`: waitlist modal only flips to success after Firestore write succeeds
- `HomeShows.astro`: Request City modal resets to form state before each open

**Data integrity**

- `index.astro`: popup email step stores `DocumentReference`; phone step calls `updateDoc` (no duplicate subscriber doc); localStorage key only set after successful write
- `events.ts`: TBA entries get `tagline: 'Coming soon'` to prevent false "On sale now" label

**Styling**

- `links.astro`: removed `white-space: nowrap` from `.primary-link`; social row wraps on mobile
- `index.css`: `"Nunito"` → `Nunito` (stylelint compliance)

**Files changed:** `src/pages/index.astro`, `src/components/home/HomeSignup.astro`, `src/components/home/HomeNav.astro`, `src/components/home/HomeCreators.astro`, `src/components/home/HomeFooter.astro`, `src/components/home/HomeShows.astro`, `src/components/layout/PageNav.astro`, `src/pages/cities/[slug].astro`, `src/pages/cities/index.astro`, `src/pages/links.astro`, `src/pages/404.astro`, `src/data/events.ts`, `src/index.css`

**Dismissed (already correct):** reveal effect (js-reveal scoping), ErrorBoundary (already CSS module + SOCIAL_URLS), NotifyModal (already has error display), AdminDashboard brand-red-rgb (already 220,38,38), cities/index.ts REGION_ORDER (South Asia present)

**Deferred:** custom cursor (design decision), cross-component subscriber dedup (architectural), tagline in tickets page (feature), shader performance (separate pass)

---

## fix: CodeRabbit PR review fixes — bugs, a11y, performance, code quality (2026-04-07)

### What changed

Four atomic commits addressing CodeRabbit review comments on PR #11.

**Bug fixes**

- `formatTime` in `HomeHero.astro`: midnight (h=0) now correctly formats as "12 AM" instead of "0 AM"
- `HomeShows.astro`: city-request modal success state only shows after `addDoc` resolves (not on error)
- `NotifyModal.astro`: keyboard focus moves to `#notify-success` on reveal so users aren't stranded on a hidden submit button
- `canada.ts`: fixed `city=London+ON` → `city=London&state=ON` and `city=St.+John%27s` → `city=St.+John%27s&state=NL` so apply form pre-selection matches the `country-state-city` library
- `useApplyForm.ts`: orphaned photo in Firebase Storage is now deleted if `addDoc` fails after upload succeeds

**Accessibility**

- Marketing consent radios wrapped in `<fieldset>`/`<legend>` — screen readers now announce the question before each Yes/No option
- Terms & Conditions button no longer accidentally toggles the checkbox (added `e.stopPropagation()`)
- Fixed `.consentSection[data-error]` border — `border-color` alone was invisible on a `border:none` base
- `termsAgreeButton` and `termsDismissButton` now have `min-height: var(--touch-target)` (48px)
- `PhotoUploadField`: replaced inline `style={{ display:'none' }}` with CSS class; preview `<img>` now has `loading="lazy"`, `width`, `height`
- `HomeCreators`: avatar images changed to `loading="lazy"` + `decoding="async"`; subtitle and bio contrast bumped to `rgba(26,26,26,0.87)` for WCAG AA

**Performance**

- Created `src/lib/constants.ts` for `YOUTUBE_VIDEO_ID` and `INSTAGRAM_REEL_URLS`
- YouTube video uses facade pattern (thumbnail + play button) — iframe only loads on click, saving ~600KB of blocking resources
- Instagram blockquote embeds + `embed.js` (~200KB) replaced with styled anchor links
- Video section background tokenized: `#fff` → `var(--off-white)`

**Code quality**

- Added `--off-white-rgb: 255, 248, 240` to `:root`; `HomeNav` scrolled background now uses token
- `HomeHero` `.line-accent` color: `#333` → `var(--charcoal)`
- `scripts/organize-images.js`: `console.log` → `console.debug` in verbose helper
- `package.json`: `engines.node` tightened to `>=20.11.0` (required for `import.meta.dirname`)
- `ErrorBoundary`: added `componentDidCatch` for production error logging
- `posthog.astro`: `window._phLoaded` → namespaced `window.__garamAnalytics.posthog`
- `AdminDashboard.test.tsx`: extracted `makeTimestamp()` helper, replaced 130-char inline mock
- `ApplicantModal`: inline `style={{ background, color }}` replaced with CSS custom property `--status-color` + `color-mix()`

### Files affected

`src/components/home/HomeHero.astro`, `src/components/home/HomeShows.astro`, `src/components/NotifyModal.astro`, `src/data/cities/canada.ts`, `src/components/apply/useApplyForm.ts`, `src/components/ApplyPage.tsx`, `src/components/ApplyPage.module.css`, `src/components/apply/PhotoUploadField.tsx`, `src/components/home/HomeCreators.astro`, `src/lib/constants.ts` (new), `src/components/home/HomeVideo.astro`, `src/index.css`, `src/components/home/HomeNav.astro`, `scripts/organize-images.js`, `package.json`, `src/components/ErrorBoundary.tsx`, `src/components/posthog.astro`, `src/components/admin/AdminDashboard.test.tsx`, `src/components/admin/ApplicantModal.tsx`, `src/components/admin/ApplicantModal.module.css`

---

## chore: remove unused shader export dir and gitignore it (2026-04-07)

### What changed

- Removed `surbhi-shader-export 4/` from git tracking — standalone dev artifact not referenced by any page, was deploying as dead weight to Vercel.
- Added `surbhi-shader-export*/` to `.gitignore` to prevent re-tracking.

### Files affected

`.gitignore`

---

## fix(qa): resolve all critical and warning issues from QA pass (2026-04-07)

### What changed

- **F1 — `@astrojs/check` installed**: Added `@astrojs/check` to `devDependencies`. `npm run check` was hanging on an interactive install prompt, breaking any CI pipeline.
- **F2 — `AdminDashboard.tsx` useRef type**: Changed `useRef<ReturnType<typeof setTimeout>>()` to `useRef<ReturnType<typeof setTimeout> | undefined>(undefined)` to satisfy React 19 strict types.
- **W1 — Nav touch targets**: Added `min-height: var(--touch-target)` to `.nav-pill` (HomeNav.astro) and `.page-nav-pill` (PageNav.astro). Both were ~32px on mobile, below the 48px WCAG 2.5.5 requirement.
- **W2 — Lazy-load country-state-city**: `useGeoData` now accepts `shouldLoad: boolean` (default `true`). `useApplyForm` defers loading until the user opens the country dropdown (`onMenuOpen`). The 8.3MB data chunk no longer loads on page mount.
- **W3 — surbhi.png converted to WebP**: 595KB PNG → 25KB WebP (96% reduction). Updated references in HomeCreators.astro, AuthorBio.astro, and hosts.astro.
- **W4 — Instagram embed fallback**: Added `<a href={url}>Watch on Instagram</a>` inside each `<blockquote>` embed so blocked/failed embeds show a working link instead of empty boxes.
- **W5 — Replace hardcoded hex values**: `.experience-left .lead color: #555` → `var(--text-secondary)` (exact match). `.exp-step p color: #777` → `var(--text-tertiary)` (exact match). `.next-show-venue color: #888` → `var(--muted)` (contrast bug fix: #888 was the failing-contrast old value).
- **W6 — Delete dead code**: Removed commented-out coverage configuration from `vitest.config.ts`.
- **Bonus — TypeScript check now 0 errors**: Added `src/env.d.ts` with `@testing-library/jest-dom/vitest` reference. Fixed `TermsModal.tsx` `querySelectorAll<HTMLButtonElement>`. Fixed `useGeoData.test.ts` spread argument pattern. Fixed `AdminDashboard.test.tsx` Timestamp mock.

### Files affected

`package.json`, `package-lock.json`, `src/env.d.ts`, `test/setup.ts`, `vitest.config.ts`, `src/components/admin/AdminDashboard.tsx`, `src/components/admin/AdminDashboard.test.tsx`, `src/components/apply/TermsModal.tsx`, `src/components/apply/useApplyForm.ts`, `src/components/ApplyPage.tsx`, `src/hooks/useGeoData.ts`, `src/hooks/useGeoData.test.ts`, `src/components/home/HomeNav.astro`, `src/components/layout/PageNav.astro`, `src/components/home/HomeCreators.astro`, `src/components/AuthorBio.astro`, `src/pages/hosts.astro`, `src/components/home/HomeVideo.astro`, `src/components/home/HomeExperience.astro`, `src/components/home/HomeHero.astro`, `public/images/surbhi.webp`

### Decisions

The TypeScript errors from `npx tsc --noEmit` were mostly test-infrastructure issues (CSS module types, jest-dom matchers not typed for Vitest) rather than production bugs. The real failures were the missing `@astrojs/check` dependency and the AdminDashboard `useRef` strict-type error. The lazy-load approach for `country-state-city` defers the 8.3MB data chunk until the user actually opens the country dropdown — zero behavior change on the happy path, significant improvement for users who never touch the location fields. The `#888` hex fix in HomeHero is a color change (not just rename) because `#888 on #FFF8F0` was a known failing contrast ratio.

---

## design: taste-review fixes — mobile ticket labels, spacing scale, backdrop, tokens (2026-04-07)

### What changed

- **HomeShows**: Ticket/notify labels now visible on mobile (were `display:none` — a conversion issue). Grid updated to 3-column at all viewports. `shows-proof` opacity 0.4→0.6 and font-size 14→15px. Padding normalized to 56px/80px.
- **HomeTestimonials**: Replaced inline `style` prop for `--quote-color` with `nth-child` CSS selectors (CLAUDE.md compliance). Card backdrop increased from 0.25→0.45 opacity with `backdrop-filter: blur(4px)` for legibility on light image areas.
- **HomeStats**: Removed `-webkit-text-stroke` from h2 and stat numbers (text-shadow already handles legibility; stroke caused jagged edges at large sizes). Desktop padding normalized to 120px.
- **HomePress**: Replaced hardcoded `#FFF0E2` with new `--cream-warm` design token. Padding normalized to 40px/56px.
- **HomeHero**: Replaced generic `bounce` keyframe with asymmetric `scrollHint` — a double-dip spring pattern that reads as intentional rather than template.
- **index.css**: Added `--cream-warm: #FFF0E2` to `:root`.

### Files affected

`src/index.css`, `src/components/home/HomeHero.astro`, `src/components/home/HomePress.astro`, `src/components/home/HomeShows.astro`, `src/components/home/HomeStats.astro`, `src/components/home/HomeTestimonials.astro`

### Decisions

Mobile ticket label was a silent conversion failure — users had no visual feedback distinguishing tap-to-buy from tap-to-notify. The `display:none` was likely left from an early mobile layout iteration. The inline style for `--quote-color` worked technically but violated project standards and made the Astro template harder to reason about. Spacing normalization targets 8px grid multiples (40, 56, 80, 120) to create visual rhythm across sections.

---

## fix: Instagram reels, YouTube embed, FAQ toggle size, hero spacing, section color separation (2026-04-07)

### What changed

- **HomeVideo — Instagram**: Replaced broken `embed/` iframes (Instagram blocked them, showed "photo or video may be broken") with 3 styled "Watch on Instagram" link cards using the Instagram gradient. No external JS, always works, links open the actual reels.
- **HomeVideo — YouTube**: Replaced click-to-load facade (unreliable on mobile, perceived as non-embedded) with a direct `<iframe>` embed. YouTube player renders immediately, user presses play.
- **HomeVideo — background**: Changed from `var(--off-white)` to `#fff` to create visual separation from the HomeCreators section above it (both were identical cream).
- **HomeFAQ — toggle circle**: Increased from 48px to 60px, font-size 18px → 24px. Circle was too small and the +/× looked cramped.
- **HomeHero — spacing**: Reduced hero top padding (80px → 64px mobile, 100px → 80px desktop), hero-content top padding (40px → 8px mobile, 60px → 32px desktop), and tightened margins between eyebrow/h1/sub/next-show. Reduces gap between the fixed nav and the pill badge, and brings the CTA buttons above the fold on mobile.

### Files changed

- `src/components/home/HomeVideo.astro`
- `src/components/home/HomeFAQ.astro`
- `src/components/home/HomeHero.astro`

## Code review fixes — a11y, data integrity, SEO (2026-04-07)

Post-audit code review pass. All findings were verified against current code before fixing.

### What changed

- **Data integrity**: Added `"South Asia"` to `REGION_ORDER` in `cities/index.ts` — cities with `region: "South Asia"` were silently dropped by `citiesByRegion()`. Removed `"lyon"` from Lausanne's `nearbyCities` (no Lyon entry exists).
- **Touch targets**: Standardized from 44px → 48px across `links.astro` (social icons, modal close), `ApplicantModal.module.css` (close button), `ApplyPage.module.css` (back button, type buttons, terms close). CLAUDE.md requires 48px; previous audit used WCAG 2.5.8 minimum of 44px.
- **BUGS.md corrections**: Fixed two contrast ratio errors (`#888` = 3.38:1 not 2.98:1; `#666` = 5.45:1 not 4.14:1 — the `#666` bug was a false positive, already passing AA). Updated touch target references to 48px.
- **NotifyModal**: Submit success now only shown in `try` block; `catch` shows an error message. Submit button disabled during async call. Added `role="dialog" aria-modal="true" aria-labelledby` to `<dialog>`. Added `id` to h2. Focus moves to close button on open; restored to opener on close via dialog `close` event. Success div gets `role="status" aria-live="polite"`. Error paragraph uses `aria-live="assertive"`. Close button touch target: 4px → min 48×48px.
- **ApplyPage — label/input association**: Country/State/City React Select fields now pass `inputId` matching `htmlFor` on the wrapping `FieldGroup`, so screen readers correctly associate labels with the Select's inner input. Removed now-redundant `aria-label` attributes.
- **ApplyPage — terms modal focus management**: Escape closes the modal. Tab/Shift+Tab cycles through the 3 action buttons. Focus moves to close button on open; restored to the Terms link on close.
- **seo-article-strategy.md**: Replaced doorway-page H1 template with guidance requiring unique city-specific H1s.

### Files affected

`src/data/cities/index.ts`, `src/data/cities/europe.ts`, `src/pages/links.astro`, `src/components/admin/ApplicantModal.module.css`, `src/components/ApplyPage.module.css`, `BUGS.md`, `src/components/NotifyModal.astro`, `src/components/ApplyPage.tsx`, `seo-article-strategy.md`

---

## Visual overhaul — CTAs, cursor, pages, photos, cleanup (2026-04-07)

Batch of visual fixes, page improvements, and code cleanup based on direct user feedback.

### What changed

- **Cursor**: turns white on dark/red sections (was invisible on HomeShows/HomeSignup)
- **Hero**: added "Next show" pill with date/city above CTA buttons
- **Experience/FAQ CTAs**: now side by side (flex-row) instead of stacked, Apply text bigger
- **HomeShows**: removed nested div for cleaner alignment, tightened proof line
- **HomeFAQ**: added border-top on first item as visual divider
- **Tickets page**: bumped h1 (32→36px), intro (17→19px), proof (12→14px) font sizes
- **FAQ page**: replaced 2-image hero with higgs-field.webp bg at 6% opacity, tightened padding, bigger question/answer fonts
- **Apply page**: bigger title (clamp 36-48px), removed white card panel (open layout on off-white), red labels, rounder inputs, bigger submit button
- **Hosts page**: moved action shot below bios (important content above fold)
- **Cities pages**: added object-position center 35% to bias toward faces, reduced max-height
- **Journal**: tightened padding across index and article pages, reduced AuthorBio whitespace
- **Images**: deleted hero.jpeg/hero-mobile.jpeg dupes (1.6MB saved), renamed /hf/ → /ai-art/, fixed HomePhotos gallery paths (removed nonexistent /gallery/ prefix), dropped missing dance-off entry
- **Class names**: .ph → .photo, .ph-span → .photo--wide, .mo → .month, .dy → .day

---

## redesign(contestant-prep): simplify layout and unify visual language (2026-04-07)

Complete visual overhaul of the `/contestant-prep` page — the private briefing guide sent to show contestants. The page had two core problems: a `max-width: 560px` container leaving excessive dead space at wider viewports, and six competing visual treatments (yellow text-stroked numbers, italic red numbers, red bullet dots, full card backgrounds, red-tinted callout cards, 40px yellow divider bars) all at the same visual weight making the content hard to scan quickly.

### What changed

- **Layout**: `max-width` 560→720px, desktop horizontal padding 48→64px. On a 1400px screen content fills ~720px instead of ~560px.
- **Section spacing**: Removed all `<Divider />` components (yellow 40px horizontal bars). Replaced with `margin-top: 48px` via a `.section` wrapper class — cleaner vertical rhythm.
- **Golden Rules**: Removed yellow text-stroke from numbers (replaced with plain bold red). Added yellow left-border accent to each rule card. Section header is now the primary/dominant heading (`clamp(22px, 5vw, 28px)` weight-900) to establish hierarchy.
- **Questions**: Body font bumped 15→16px, color lightened to `--charcoal` (was `--text-light`), row gap 10→14px for breathing room.
- **Come Prepared**: Replaced white card + red bullet dot pattern with simple ✓ checklist rows — less visual noise, same information.
- **Day Of**: Merged "What to Wear" and "Bring Friends" (two identical-looking single-paragraph sections) into one "Day Of" section with a dash-list. Eliminates a redundant section header.
- **Arrival times**: Added `border-top: 4px solid var(--electric-yellow)` accent to time cards.
- **Notes (Guys/Girls)**: Replaced red-tinted background callout cards with left-border note style (`border-left: 4px solid var(--brand-red)`, no background). Both notes share one `.section` wrapper.
- **Unused imports**: Removed `Clock`, `Users`, `Shirt` from Lucide import.

### Files changed

- `src/components/ContestantPrepPage.tsx`
- `src/components/ContestantPrepPage.module.css`

### Decisions

Chose wider column over tabs — contestants read this linearly before going on stage, not as reference during. Tabs would add interaction complexity for no real benefit. Unified visual language (one accent color per element type, one size treatment per hierarchy level) rather than adding more variety.

## Accessibility and security bug fixes (2026-04-07)

Resolved 9 open bugs from BUGS.md — all were accessibility or security issues that didn't require external services.

### What changed

- **`cors.json`**: Restricted Firebase Storage CORS from wildcard origin to `garammasaladating.com` only. Removed DELETE, POST, HEAD methods (was allowing all methods on all origins).
- **`src/index.css`**: Fixed WCAG AA color contrast failures. `--muted` updated from `#888` (2.98:1) to `#6b6b6b` (5.06:1). `--text-light` updated from `#666` (4.14:1) to `#595959` (6.65:1). Added global `:focus-visible` ring for keyboard navigation.
- **`src/components/ApplyPage.module.css`**, **`AdminLogin.module.css`**, **`ApplicantModal.module.css`**: Removed `outline: none` from 4 CSS rules that were suppressing keyboard focus indicators with no replacement.
- **`src/pages/links.astro`**: Social icons enlarged from 40×40px to 44×44px (WCAG 2.5.8). Modal close button padding increased to meet 44×44px minimum.
- **`src/components/admin/ApplicantModal.module.css`**: Close button `min-width/height: 44px` added. Converted overlay+modal div structure to native `<dialog>::backdrop` pattern.
- **`src/components/admin/ApplicantModal.tsx`**: Replaced custom `<div>` overlay with native `<dialog>` element using `.showModal()`. Provides built-in focus trap, `aria-modal` semantics, and scroll lock. Escape key now uses `cancel` event instead of window keydown listener.
- **`src/components/layout/PageNav.astro`**, **`src/components/home/HomeNav.astro`**: Added `aria-current="page"` on active nav links using `Astro.url.pathname`.
- **`src/components/home/HomeShows.astro`**: Replaced `<div role="button" tabindex="0">` with semantic `<button type="button">`. Added `width: 100%; font: inherit; text-align: left` to CSS reset.
- **`src/components/admin/AdminLogin.tsx`**, **`AdminLogin.module.css`**: Added visible `<label>` elements for Email and Password inputs. Removed redundant `aria-label` attributes now that visible labels exist.

### Not fixed (requires external services)

- Rate limiting on API endpoints (needs Upstash or Vercel Edge)
- CAPTCHA on apply form (needs Firebase App Check)
- Server-side file-type validation (needs Firebase Cloud Function)
- Admin pagination (low priority at current volume)

## Enhancements batch — CTAs, perf, SEO, conversion, security (2026-04-07)

Implemented 9 items from ENHANCEMENTS.md. Removed completed items from backlog.

### What changed

- **`src/layouts/BaseLayout.astro`**: Removed click-empty-space-to-go-home behavior (conversion risk). Removed unused hero.avif/hero-mobile.avif preloads (hero uses WebGL shader, not images). Cleaned up unused `isHome` variable.
- **`src/components/home/HomeExperience.astro`**: Changed h2 from "NYC's #1 Live South Asian Dating Show" to "How the Night Works" to reduce tagline repetition. Added Get Tickets + Apply CTA below description.
- **`src/components/home/HomeFAQ.astro`**: Converted from custom JS accordion to native `<details>/<summary>`. Fully indexable by Google when collapsed. Added Get Tickets + Apply CTA below FAQ list.
- **`src/components/home/HomeCreators.astro`**: Shortened bios to 2-sentence teasers. Changed name links from external social URLs to internal `/hosts` page. Added "Meet the Hosts" CTA. Removed unused CREATOR_URLS import.
- **`src/components/home/HomeShows.astro`**: Added social proof line ("40+ shows sold out · 2,000+ audience members · 13 couples matched").
- **`src/pages/tickets.astro`**: Added social proof line near ticket cards.
- **`src/components/gtm.astro`**: Deferred GTM loading via `requestIdleCallback` (3s timeout fallback).
- **`src/components/posthog.astro`**: Deferred PostHog loading via `requestIdleCallback`.
- **`src/components/meta-pixel.astro`**: Deferred Meta Pixel loading via `requestIdleCallback`.
- **`vercel.json`**: Tightened CSP from wildcard `*` to explicit allow-list for GTM, GA, Meta, PostHog, Firebase, Vercel, Eventbrite.
- **`src/components/ApplyPage.tsx`**: Fixed flaky test — replaced `setTimeout` with `requestAnimationFrame` for scroll-to-error.
- **`ENHANCEMENTS.md`**: Removed 13 completed items. Backlog now has items needing content assets or external action.

---

## Site audit remediation — SEO, FAQ, sold-out display, broken images (2026-04-07)

Reviewed the site audit against current codebase (~70 commits after the audit). Fixed remaining issues, deferred visual/home-page changes to ENHANCEMENTS.md.

### What changed

- **`src/pages/faq.astro`**: Fixed broken hero image (`gmd-37.webp` deleted, replaced with `on-stage.webp`). Changed footer email from `hello@` to `contact@` (matches Organization JSON-LD). Made FAQ answers linkable with `set:html` — added HTML links for /tickets, /apply, and press email. Added `stripHtml()` to keep JSON-LD text clean. Added `.faq-answer-text a` link styling.
- **`src/pages/index.astro`**: Removed `<meta name="keywords">` (ignored by Google since 2009). Removed duplicate FAQPage JSON-LD (the /faq page owns the canonical schema). Visual HomeFAQ component unaffected — it uses `copy.ts` data.
- **`astro.config.mjs`**: Added sitemap filter excluding `/admin` and `/contestant-prep` routes.
- **`src/layouts/BaseLayout.astro`**: Added `og:image:alt` meta tag for social sharing accessibility.
- **`src/pages/tickets.astro`**: Events with "Sold out" tagline now show muted "Sold Out" pill instead of active "Get Tickets" CTA. Link preserved for waitlist access.
- **`src/components/home/HomeShows.astro`**: Same sold-out display logic (defensive — past sold-out events are already filtered by `isEventPast()`).
- **`src/pages/journal/index.astro`**: Replaced hardcoded "First essays drop April 7" with evergreen fallback text and Instagram link.
- **`BUGS.md`**: Added fixed entry for broken FAQ image.
- **`ENHANCEMENTS.md`**: Added 7 deferred items: click-to-home removal, bio shortening, h2 variation, social proof near CTAs, hero preload cleanup, FAQ content unification.

### Deferred (added to ENHANCEMENTS.md)

- Remove "click empty space to go home" behavior (conversion risk)
- Shorten HomeCreators bios + add /hosts link
- Vary HomeExperience h2 to reduce tagline repetition
- Add social proof stats near ticket CTAs
- Clean up hero image preloads if unused
- Unify FAQ content between home and /faq

---

## Code review fixes — bugs, accessibility, mobile-first, and docs (2026-04-07)

Verified each finding against current code before applying. Skipped color token replacements where no exact token match exists (to avoid visual regressions) and the galleryImages path consolidation (requires moving image files on disk).

### What changed

- **`package.json`**: Lowered `engines.node` from `>=22` to `>=20` to match the `node-version: 20` used in `ci.yml` and `article-refresh.yml`. Eliminates engine check failures when running locally with Node 20.
- **`scripts/optimize-images.js`**: Fixed OG image filename mismatch — script was writing `og-image-new.jpg` but `BaseLayout.astro` defaults to `og-image.jpg`. Also gated all `console.log`/`console.error` calls behind a `VERBOSE=1` env flag; fatal catch remains ungated.
- **`src/components/ApplyPage.module.css`**: Added `min-height: 48px` to `.retryButton` (computed height was ~46px, below the 48px touch target minimum). Converted `.gridTwo`/`.gridThree` from desktop-first (`max-width: 600px`) to mobile-first (`min-width: 601px`). Replaced two `rgba(0,0,0,0.1)` border values with `var(--border)` and one hardcoded `rgba(220,38,38,0.3)` with `rgba(var(--brand-red-rgb),0.3)`.
- **`src/components/home/HomeCreators.astro`**: Removed unused `.host-avatar` CSS rule — template only uses `.host-avatar-img`, the emoji-avatar rule was dead code.
- **`CLAUDE.md`**: Added `plaintext` language specifier to the `src/` directory structure code fence. Rewrote the font-size "Never do" bullet to clearly express prohibition ("Do not use...").
- **`CHANGELOG.md`**: Added blank line between `### Photo mapping` heading and the table below it for correct markdown rendering.

### Skipped (with rationale)

- `background: white` on `.panel` → `--off-white` is `#FFF8F0`, not `#fff`; replacement would change appearance
- `rgba(0,0,0,0.08)` box-shadow → no shadow token in `:root`
- HomeCreators hardcoded colors → no exact token matches; `--charcoal-rgb` doesn't exist
- `galleryImages` path inconsistency → requires moving actual image files

---

## CodeRabbit review fixes — bugs and code quality (2026-04-07)

Applied the valid subset of CodeRabbit suggestions after verifying each against current code. Skipped suggestions that don't apply (no stylelint in project, shader files are a different project, intentional design decisions).

### What changed

- **`.github/workflows/article-refresh.yml`**: Added `permissions: contents: write` so the monthly article refresh workflow can push commits. Without it the git push step fails with 403 when GITHUB_TOKEN defaults to read-only.
- **`src/data/journal/bollywood.ts`**: Fixed factual error — Deepika Padukone plays Veronica in Cocktail (2012), not Meera. Diana Penty plays Meera. First paragraph had the characters swapped.
- **`src/components/home/HomeMarquee.astro`**: Fixed invisible dot separators — `.dot` was `color: var(--brand-red)` on a red background. Changed to `white`.
- **`src/data/events.ts`**: Changed `url: '#'` to `url: ''` for TBA cities — `'#'` was a sentinel hack.
- **`src/components/home/HomeShows.astro`**: Simplified `isLive` check from `url && url !== '#'` to `Boolean(url)` now that the sentinel is gone.
- **`src/components/ContestantPrepPage.module.css`**: Renamed keyframes from camelCase (`prepSpin`, `fadeIn`) to kebab-case (`prep-spin`, `fade-in`) per CSS convention. Updated all `animation` references.
- **`src/data/cities/types.ts`**: Added `"South Asia"` to `CityRegion` union.
- **`src/data/cities/southeast-asia.ts`**: Updated Colombo and Kandy `region` from `"Southeast Asia"` to `"South Asia"` (Sri Lanka is South Asia). Removed undefined city slugs `singapore` and `kuala-lumpur` from all nearbyCities arrays in the file.
- **`src/data/cities/east-asia.ts`**: Removed undefined `singapore` from Seoul and Hong Kong nearbyCities.
- **`src/data/cities/europe.ts`**: Removed undefined slugs `lyon` (Geneva), `strasbourg` (Basel), `venice` (Ljubljana), `belgrade` (Zagreb) from nearbyCities.
- **`src/data/cities/uk.ts`**: Removed undefined `dundee` from Aberdeen nearbyCities.
- **`src/components/ErrorBoundary.tsx`**: Extracted all inline `style={}` props into `ErrorBoundary.module.css` using CSS vars. Replaced hardcoded Instagram URL with `SOCIAL_URLS.instagram`.
- **`src/components/ApplyPage.tsx`**: Replaced two hardcoded Instagram URLs with `SOCIAL_URLS.instagram` from `@/data/socials`.

### Decisions

- Did not add stylelint config — project has no stylelint dependency.
- Did not fix popup localStorage order — intentional design to suppress re-show even on Firestore failure.
- Did not change bollywood.ts "10 movies" title — content decision for the author.

## Rework photo integration based on feedback (2026-04-07)

Reverted experience step photos (too small, not impactful). Fixed testimonials to show the crowd photo clearly (0% background overlay, glass on cards). Swapped hosts page to sitting-down photo. Changed photo breaks from single full-bleed to two photos side by side. Added Event 2 photos throughout.

### What changed

- **`HomeExperience.astro`**: Reverted to original yellow numbers, no photos.
- **`HomeTestimonials.astro`**: Removed dark background overlay — crowd photo now fully visible. Glass-morphism moved to individual quote cards (dark translucent + backdrop blur). Changed accent color on heading em to yellow for contrast on photo.
- **`hosts.astro`**: Swapped action shot from standing (#1) to sitting-down posed photo (#117).
- **`HomePhotoBreak.astro`**: Now takes `left` and `right` photo props instead of single `src`. Two photos side by side with 4px gap (mobile) / 6px gap (desktop). 3:2 mobile, 16:9 desktop.
- **`index.astro`**: Updated photo break props with Event 2 photos (on-stage, journal-featured, the-match, dance-off, tickets-hero, pure-chaos).
- **`src/data/copy.ts`**: Removed image/alt/pos fields from EXPERIENCE_STEPS.

---

## Fix CodeRabbit code review comments (2026-04-07)

Resolved actionable CodeRabbit review comments on PR #11.

### What changed

- **`src/components/home/HomeCreators.astro`**: Added `image` field to each host data object; render uses `host.image` instead of `host.name === 'Surbhi'` ternary. Added `:focus-visible` outline on host name links for keyboard accessibility.
- **`src/components/home/HomeHero.astro`**: Added `aria-hidden="true"` to the decorative WebGL canvas. Added `:focus-visible` styles for `.btn-hot` and `.btn-outline` so keyboard users get a visible focus ring.
- **`src/pages/index.astro`**: Guarded `[data-reveal]` IntersectionObserver behind `'IntersectionObserver' in window` check and `prefers-reduced-motion` media query — content is immediately revealed when JS is unavailable or reduced motion is preferred. Added `<noscript>` CSS fallback and `@media (prefers-reduced-motion)` rule to ensure content is never hidden.
- **`src/pages/south-asian-dating-tips/[slug].astro`**: Replaced inline `style={i === 0 ? "margin-top: 0" : "margin-top: 12px"}` with a `.tip-post-h3--spaced` CSS class toggled via `class:list`.
- **`src/components/admin/ApplicantModal.module.css`**: Bumped `statusSelect` and `notesTextarea` from `font-size: 14px` to `16px` to prevent iOS auto-zoom on form inputs.

### Decisions

- `HomePress.astro` press items are already `<a>` tags — that review comment was stale, no change needed.
- `tickets.astro` `opacity: 0.5` on TBA card was already removed in a prior commit — no change needed.

---

## Organic event photography across site (2026-04-07)

Removed the dedicated photo gallery section. Integrated event photos organically into existing sections where they naturally belong.

### What changed

- **Killed `HomePhotos` gallery** from homepage — photos belong in context, not a portfolio grid.
- **`HomeExperience.astro`**: Each of the 4 steps now shows a rounded photo thumbnail (72px mobile, 88px desktop) with the step number overlaid. Photos match the step content.
- **`HomeTestimonials.astro`**: Dark cinematic treatment — crowd photo behind at ~85% dark overlay. Quote cards are now glass-morphism (translucent with backdrop blur). White text on dark.
- **`HomePhotoBreak.astro`** (new): Full-bleed photo separator component. 3 placed between homepage sections (280px mobile, 420px desktop).
- **`hosts.astro`**: Wide action shot of hosts on stage between intro and bios. Rounded corners, 3:2 aspect ratio.
- **`src/data/copy.ts`**: Added `image`, `alt`, `pos` fields to `EXPERIENCE_STEPS`.

### Photo mapping

| Placement         | Photo                                |
| ----------------- | ------------------------------------ |
| Experience Step 1 | after-party (crowd)                  |
| Experience Step 2 | on-stage (blindfolded round)         |
| Experience Step 3 | testimonial-reaction (audience gasp) |
| Experience Step 4 | pure-chaos (lifting moment)          |
| Testimonials BG   | the-crowd (audience laughing)        |
| Photo break 1     | the-match (couple reveal)            |
| Photo break 2     | dance-off (final lineup)             |
| Photo break 3     | magic-moment (intimate)              |
| Hosts page        | links-hero (both hosts on stage)     |

---

## Add optimized event photos and image pipeline (2026-04-07)

17 source photos from two Top Secret Comedy Club events optimized via sharp. DSLR files (12-27MB) compressed to 40-80KB AVIF. Created reusable optimization script.

---

## Code Review Fixes — PR #11 (2026-04-07)

Resolved 5 of 6 issues flagged in automated code review of the ui-v3-seo-rewrite PR. The `console.log` in `scripts/refresh-articles.js` was intentionally kept as it provides useful progress output for GitHub Actions runs.

### What changed

- **`firestore.rules`**: Added `city` to `validSubscriber()` `hasOnly` allowlist + optional city field validation. City-page subscriber writes were being silently rejected because `cities/[slug].astro` writes a `city` field that was not in the validator's allowlist (critical functional bug).
- **`src/index.css`**: Corrected `--brand-red-rgb` from `233, 30, 118` (old pink `#E91E76`) to `220, 38, 38` (correct for `--brand-red: #DC2626`). Affected 62+ `rgba()` usages rendering magenta instead of red.
- **`src/index.css`**: Removed `--font-jetbrains: "Nunito"` backward-compat alias; replaced all 19 usages with `var(--font-body)`. Added `--text-secondary: #555` and `--text-tertiary: #777` design tokens.
- **13 files**: Replaced scattered hardcoded hex grays (`#555`, `#666`, `#777`, `#888`, `#999`, `#b91c1c`, `#FFC400`) with CSS custom properties in all new/modified components and pages.
- **`src/components/NotifyModal.astro`** (new): Extracted the notify modal HTML, script, and CSS that was duplicated in `HomeShows.astro` and `tickets.astro` into a shared component. Accepts optional `source` prop.

### Files affected

`firestore.rules`, `src/index.css`, `src/components/NotifyModal.astro` (new), `src/components/home/HomeShows.astro`, `src/pages/tickets.astro`, `src/components/home/HomeExperience.astro`, `src/components/home/HomeFAQ.astro`, `src/components/home/HomePress.astro`, `src/components/ContestantPrepPage.module.css`, `src/components/ApplyPage.module.css`, `src/components/AuthorBio.astro`, `src/pages/cities/[slug].astro`, `src/pages/cities/index.astro`, `src/pages/faq.astro`, `src/pages/privacy.astro`, `src/pages/terms.astro`

---

## 120 SEO Articles + Staggered Publishing System (2026-04-06)

Major content expansion: 120 journal articles across 14 categories, publishing every 2 days from April 7 through December 2026 via automated daily rebuild.

### What changed

- **Refactored `src/data/journal.ts`** into `src/data/journal/` directory (16 files) mirroring the cities/ pattern
- **Re-dated 10 existing articles** from fake backdates to honest future dates (Apr 7-25)
- **Wrote 110 new SEO articles** targeting keywords with 500K+ monthly addressable search volume
- **Added `relatedSlugs` field** to JournalPost for cross-linking ("You might also like" section)
- **Added prev/next navigation** to article pages
- **Enabled inline HTML** in article body text for natural cross-links between articles
- **Removed Kampala** city page (not in Africa keep list)
- **Added daily rebuild cron** (.github/workflows/daily-rebuild.yml) for scheduled article publishing
- **Added monthly refresh cron** (.github/workflows/article-refresh.yml + scripts/refresh-articles.js) for dateModified freshness signals

### Article categories (110 new)

1. App Fatigue & Alternatives (8) — Dil Mil, Hinge, Muzz, Bumble reviews
2. Dating Culture & Advice (15) — telling parents, red flags, rishta culture, ABCD/FOB
3. Identity & Demographics (8) — third culture kids, NRI, LGBTQ, tech bros, divorce
4. Comedy & Entertainment (5) — NYC comedy guide, Indian Love Is Blind
5. Events & IRL Dating (5) — speed dating, meeting singles, date ideas
6. Seasonal (5) — shaadi season, cuffing season, Diwali, Holi, Valentine's
7. Matrimony Platforms (8) — Shaadi.com, BharatMatrimony, Jeevansathi, Betterhalf
8. Community Singles (4) — Sikh, Gujarati, Punjabi, Jain events
9. Bollywood & Dating (10) — gaslighting movies, breakup films, toxic heroes
10. Cross-Cultural Intros (10) — introducing partners to Indian/Punjabi/Gujarati/Tamil/Bengali parents
11. Toxic Dating Patterns (8) — gaslighting, breadcrumbing, love bombing, ghosting
12. Caste, Class & Financial (8) — dating across castes, money dynamics, career pressure
13. Arranged Marriage Deep Dives (8) — timelines, red flags, biodata, NRI complications
14. Community Deep Dives (8) — South Indian, Bengali, Pakistani, Muslim, Hindu, Bangladeshi

### Key decisions

- Every 2 days publishing schedule (not backdated) with daily Vercel deploy hook
- Articles only appear when their datePublished date arrives (SSG date filter)
- Monthly cron refreshes dateModified on articles older than 60 days for Google freshness
- Each article has 12-20 body blocks, 3-5 FAQs for JSON-LD, 2-3 inline cross-links, 2-3 relatedSlugs

---

## Add 8 SEO journal articles: Community Deep Dives

Wrote full content for all 8 articles in `src/data/journal/community-deep-dives.ts`, replacing the empty array placeholder. Articles cover the "Community Deep Dives" category — South Indian, Marathi, Bengali, Pakistani, South Asian Muslim, Hindu, Bangladeshi, and vegetarian desi dating — with Surbhi's direct and culturally specific voice.

### Articles added (slugs)

1. `south-indian-dating-culture` — Nov 17 — Tamil/Telugu/Kannada/Malayalam perspectives, sambandhi culture, thali traditions
2. `marathi-dating-practical-expectations` — Nov 19 — Maharashtrian pragmatism, Maharashtra Mandal, family dynamics
3. `bengali-dating-culture` — Nov 21 — Adda culture, food as love language, progressive norms, West Bengali vs Bangladeshi split
4. `pakistani-dating-america` — Nov 23 — Dual-world navigation, religion nuance, community judgment, hybrid app/rishta approach
5. `muslim-dating-south-asian` — Nov 25 — Halal dating, Muzz/Salams landscape, wali question, interfaith stakes
6. `hindu-dating-expectations` — Nov 27 — Caste dynamics, vegetarianism as religious practice, festival infrastructure, kundali matching
7. `bangladeshi-dating-diaspora` — Nov 29 — Tight-knit community dynamics, Bangladeshi identity distinct from Bengali/Pakistani, Liberation War context
8. `vegetarian-dating-desi` — Dec 1 — Jain vs Hindu vegetarianism, the 'will they eat my mom's food' test, non-vegetarian partner compatibility

### Structure per article

- 12–18 PostBlock items (h2/h3/p mix, always opens with p)
- 3–5 FAQs for JSON-LD schema
- metaDescription under 160 chars with primary keyword
- 2–3 natural inline cross-links to related articles
- CTA paragraph pointing to tickets page in final section
- 2–3 relatedSlugs

### Files affected

- `src/data/journal/community-deep-dives.ts` — full content written from empty array

---

## Add 8 SEO journal articles: Toxic Dating Patterns in Desi Culture

Wrote full content for all 8 articles in `src/data/journal/toxic-patterns.ts`, replacing the empty array placeholder. Articles cover the full "Toxic Dating Patterns in Desi Culture" category with Surbhi's voice, culturally specific analysis, and SEO-optimized structure.

### Articles added (slugs)

1. `gaslighting-desi-relationships` — Sep 30
2. `breadcrumbing-desi-dating` — Oct 2
3. `love-bombing-desi-culture` — Oct 4
4. `desi-situationship-trap` — Oct 6
5. `emotional-unavailability-desi-men` — Oct 8
6. `ghosting-desi-dating` — Oct 10
7. `weaponized-compatibility-family-pressure` — Oct 12
8. `comparison-culture-toxic-desi-dating` — Oct 14

### Structure per article

- 12–18 PostBlock items (h2/h3/p mix, always opens with p)
- 3–5 FAQs for JSON-LD schema
- metaDescription under 160 chars with primary keyword
- 2–3 natural inline cross-links to related articles
- CTA to Garam Masala Dating at the close
- 2–3 relatedSlugs for cross-linking

### Files affected

- `src/data/journal/toxic-patterns.ts` — full rewrite with all 8 articles

---

## Rewrite all US city H1s and titleTags to be unique (anti-doorway-page fix)

Google treats templated city pages with identical "[City]'s Desi Dating Night Is Coming" H1s and "South Asian Singles Events [City] | Garam Masala Dating" titleTags as doorway pages. Rewrote every h1 and titleTag across 6 US city data files (75 cities total) so that no two cities share the same structure.

### What changed

- **active.ts (7 cities):** Replaced 5 templated H1s and all 7 templated titleTags. Preserved the 2 already-unique H1s (Salt Lake City, Denver).
- **us-northeast.ts (15 cities):** All H1s and titleTags rewritten with unique, city-specific copy.
- **us-southeast.ts (16 cities):** All H1s and titleTags rewritten.
- **us-midwest.ts (18 cities):** All H1s and titleTags rewritten.
- **us-south-texas.ts (7 cities):** All H1s and titleTags rewritten. Includes cultural references (Hillcroft, Aggies, Keep Austin Weird).
- **us-west.ts (12 cities):** All H1s and titleTags rewritten.

### H1 format variety includes

- Questions: "Where Do Desi Singles Go in Chicago?"
- Statements: "Boston Finally Gets a Live Dating Show Worth Showing Up For"
- Cultural references: "Oak Tree Road Deserves a Dating Show" (Edison), "Green Street Has Enough Bars" (Champaign)
- Direct/playful: "Troy, Michigan Has More Desi Singles Than Your Group Chat"
- Imperative: "Stop Swiping, Seattle. Come Meet Someone in Person."
- Data-driven: "130,000 South Asians in DFW and the Dating Scene Is Still Broken"

### titleTag format variety includes

- "[City] Desi Dating Show | Garam Masala Dating"
- "[City] Indian Singles Mixer | Garam Masala Dating"
- "Live Desi Dating Night [City] | Garam Masala Dating"
- "[City] [State] Desi Singles Event | Garam Masala Dating"
- "[University] Desi Dating Night | Garam Masala Dating"

### Rules followed

- No em dashes, no double dashes
- Every H1 is unique across the entire site
- Title tags kept under 60 characters where possible
- No other fields changed (bodyParagraphs, ctas, slug, etc.)

### Files affected

- `src/data/cities/active.ts`
- `src/data/cities/us-northeast.ts`
- `src/data/cities/us-southeast.ts`
- `src/data/cities/us-midwest.ts`
- `src/data/cities/us-south-texas.ts`
- `src/data/cities/us-west.ts`

## Expand Europe cities and rewrite international-other.ts

### europe.ts: added 47 new cities (73 total)

New cities by country:

- **Netherlands (4):** Eindhoven, Delft, Groningen, Leiden
- **Germany (7):** Aachen, Stuttgart, Nuremberg, Darmstadt, Dresden, Cologne, Dusseldorf
- **Belgium (2):** Leuven, Ghent
- **Switzerland (2):** Lausanne, Basel
- **Ireland (2):** Cork, Galway
- **Portugal (2):** Porto, Braga
- **Spain (2):** Valencia, Seville
- **Italy (5):** Bologna, Turin, Padua, Naples, Florence
- **Sweden (3):** Gothenburg, Uppsala, Lund
- **Finland (2):** Tampere, Oulu
- **Norway (1):** Trondheim
- **Poland (2):** Krakow, Wroclaw
- **Czech Republic (1):** Brno
- **Hungary (1):** Budapest
- **Romania (2):** Bucharest, Cluj-Napoca
- **Bulgaria (1):** Sofia
- **Lithuania (1):** Vilnius
- **Latvia (1):** Riga
- **Slovenia (1):** Ljubljana
- **Croatia (1):** Zagreb
- **Greece (2):** Athens, Thessaloniki
- **Cyprus (2):** Nicosia, Limassol

All 26 existing cities preserved unchanged.

### international-other.ts: restructured and expanded (22 cities)

**Removed (10 cities):**

- Middle East (cut for legal/content): Dubai, Abu Dhabi, Doha, Muscat
- Moved to separate files: Singapore, KL, Bangkok, Tokyo, Seoul, Hong Kong

**Region updates:**

- NZ cities (Auckland, Wellington, Christchurch): "Asia-Pacific" to "Pacific Islands"
- Fiji/Suva: "Asia-Pacific" to "Pacific Islands"
- Caribbean cities: "Caribbean & South America" to "Caribbean"
- Africa cities: kept "Africa" (no change)

**Added (7 cities):**

- Pacific Islands: Nadi (FJ), Lautoka (FJ)
- Africa: Mombasa (KE)
- Caribbean: San Fernando (TT), Chaguanas (TT), New Amsterdam (GY), San Juan (PR)

**Files modified:**

- `src/data/cities/europe.ts`
- `src/data/cities/international-other.ts`

**Notes:**

- All regions match valid CityRegion type values
- No em dashes, double dashes, or AI slop in copy
- TypeScript and ESLint pass clean
- nearbyCities updated to reference new slugs where appropriate
- Panama City nearbyCities updated to use new Caribbean slugs instead of old Middle East refs

## Add city data for India, Southeast Asia, and East Asia

Added three new TypeScript city data files for international expansion pages.

### india.ts (46 cities)

- **Tier 1 (9):** Mumbai, Delhi, Gurgaon, Noida, Bangalore, Hyderabad, Chennai, Pune, Kolkata
- **Tier 2 (14):** Ahmedabad, Chandigarh, Jaipur, Lucknow, Kochi, Goa, Indore, Thiruvananthapuram, Coimbatore, Nagpur, Vadodara, Surat, Visakhapatnam, Bhopal
- **Tier 3 (23):** Mysore, Dehradun, Mangalore, Manipal, Amritsar, Ludhiana, Patna, Ranchi, Bhubaneswar, Raipur, Guwahati, Shillong, Pondicherry, Jamshedpur, Trichy, Vellore, Warangal, Kanpur, Allahabad, Varanasi, Jodhpur, Udaipur, Kota
- All cities: status "coming-soon", addressCountry "IN", region "India"
- CTAs: waitlist + apply with city param only (no state)

### southeast-asia.ts (6 cities)

- Bangkok (TH), Chiang Mai (TH), Ho Chi Minh City (VN), Manila (PH), Colombo (LK), Kandy (LK)
- Sri Lanka cities use "desi" framing, not "Indian"

### east-asia.ts (7 cities)

- Tokyo (JP), Osaka (JP), Nagoya (JP), Seoul (KR), Taipei (TW), Hsinchu (TW), Hong Kong (HK)
- Each has unique, location-specific body copy (~400 words, 4-5 paragraphs)

**Files created:**

- `src/data/cities/india.ts`
- `src/data/cities/southeast-asia.ts`
- `src/data/cities/east-asia.ts`

**Notes:**

- index.ts already imported these files (wired up in a previous commit)
- No em dashes, double dashes, or AI-sounding copy
- TypeScript and ESLint pass clean

## Audit implementation: SEO, conversion, mobile, resilience

### SEO meta fixes

- Fix logo URL in JSON-LD: `logo.png` (didn't exist) → `images/logo.svg`
- Add `og:site_name="Garam Masala Dating"` to all pages
- Add `twitter:site` and `twitter:creator` tags
- Add `ogType` prop to BaseLayout (default "website", blog posts pass "article")
- Blog posts get `article:published_time` and `article:modified_time` meta tags

### Conversion: direct Eventbrite links

- Show cards on homepage now link directly to each event's Eventbrite URL (was /tickets)
- "Tickets" label → "Get Tickets" with `target="_blank"`
- Removes one click from the purchase funnel

### Mobile: iOS auto-zoom prevention

- Hero `.btn`: 14px → 16px
- HomeNav `.nav-pill`: 11px → 16px
- PageNav `.page-nav-pill`: 11px → 16px
- All interactive elements now ≥16px to prevent iOS Safari auto-zoom on focus

### Resilience

- New `ErrorBoundary.tsx` wraps ApplyPage — catches React crashes and shows friendly fallback with refresh button and Instagram DM link instead of white screen

### Auto-generated sitemap

- Install `@astrojs/sitemap` integration — sitemap auto-generated at build time
- Delete stale `public/sitemap.xml` that was missing 5+ pages and had old dates

### Backlog additions

- Placeholder photo gallery, video section, section CTAs, press logos, testimonial badges, scarcity indicators, discount code preview logged in ENHANCEMENTS.md

## WCAG accessibility audit — non-visual fixes

Comprehensive accessibility pass across the entire site. Only changes that have zero visual impact on current layouts/responsiveness were applied. Visual-impact issues logged in BUGS.md.

### Landmarks & navigation

- `<main id="main-content">` added to all 15 pages (was only on index.astro)
- Skip-to-content link in BaseLayout (sr-only, visible on keyboard focus)
- `aria-label="Main navigation"` on HomeNav and PageNav

### Apply page form (ApplyPage.tsx)

- FieldGroup now links labels via `htmlFor` to matching input `id`s
- Error messages get `role="alert"` and are linked to inputs via `aria-describedby`
- Inputs get `aria-invalid` when in error state
- Required fields get HTML `required` attribute
- react-select components get `aria-label` (Country, State, City)
- Toggle buttons ("For myself" / "For a friend") get `aria-pressed`
- Success panel gets `role="status"` + `aria-live="polite"`
- Toast notification gets `role="alert"` + `aria-live="assertive"`
- Name/referrer inputs get `autocomplete="name"`
- Instagram `@` prefix gets `aria-hidden="true"`

### Admin components

- Filter selects get `aria-label` ("Filter by gender", "Filter by city")
- Deleted toggle button gets `aria-expanded` + `aria-controls`
- Loading state gets `role="status"` + `aria-live="polite"`
- Toast gets `role="alert"` + `aria-live="assertive"`
- ApplicantCard: `tabindex=0`, `role="button"`, keyboard handler (Enter/Space)
- AdminLogin: `aria-label` on inputs, `required`, `aria-invalid`, error `role="alert"`

### Misc

- Decorative SVGs in links page get `aria-hidden="true"`
- Newsletter signup step-2 and success get `aria-live="polite"`

### Logged in BUGS.md (visual-impact, deferred)

- Color contrast: `#888` and `#666` on `#FFF8F0`
- `outline:none` without focus replacement
- Social icon / modal close button touch targets below 44px
- ApplicantModal missing focus trap
- HomeShows div-as-button
- Missing `aria-current="page"` on nav
- AdminLogin missing visible labels

## Multi-page updates: apply form, tickets notify, journal/FAQ width, city signup

### Apply form

- Income ranges refined: split $100k–$200k into $100k–$150k and $150k–$200k
- Community and income fields are now optional (no longer required for submission)
- Added hint under Instagram handle: "Follow @garammasaladating and DM us for a faster response"

### Tickets page

- TBA event cards are no longer grayed out / disabled
- TBA cards now show "Notify Me" button that opens a modal to collect email
- Saves to Firebase `notifications` collection with source `tickets-notify`

### Journal + FAQ pages

- Journal card gap increased from 2px to 12px (sections were visually touching)
- Both journal and FAQ containers widened from 560px to 680px to reduce empty side margins

### City pages

- Active city pages (with upcoming events) now show a two-step email + phone signup section after the CTAs
- Pattern matches home page "Spice List" flow: email → phone → success
- Saves to Firebase `subscribers` collection with city tracking

**Files:** `src/types/application.ts`, `src/components/ApplyPage.tsx`, `src/components/ApplyPage.module.css`, `src/pages/tickets.astro`, `src/pages/journal/index.astro`, `src/pages/faq.astro`, `src/pages/cities/[slug].astro`, `test/application.test.ts`

## Fix apply page hydration errors + country selector stuck on loading

- **Hydration fix:** Changed `ApplyPage` from `client:load` to `client:only="react"` — the form uses browser APIs (`window.history`, `window.location`) that cause SSR/client mismatches. No SEO value in server-rendering a form, so skip SSR entirely.
- **Country selector timeout:** Added 5-second timeout to `useGeoData` dynamic import. Previously, if the `country-state-city` chunk hung, the selector stayed disabled with "Loading..." forever.
- **Retry on failure:** When geo data fails to load (timeout or network error), the country field now shows a "tap to retry" button instead of a permanently disabled dropdown.

**Files:** `src/pages/apply.astro`, `src/hooks/useGeoData.ts`, `src/components/ApplyPage.tsx`, `src/components/ApplyPage.module.css`

## Fix article authors, apply page polish, remove chili emoji

- All article authors changed from "Garam Masala Dating" → "Surbhi" (journal.ts: 5 posts, tips.ts: 3 posts, AuthorBio component)
- Submit button: removed chili emoji (invisible on red background), added white-space: nowrap, reduced padding
- Country field: removed "Type your country" fallback placeholder, now always shows "Select..." like other dropdowns
- Cleaned up unused `geoFailed` destructuring

## Fix nav overflow on mobile: shrink logo + tighten pills

Both navs (HomeNav, PageNav) overflowed on 320px because 160px logo + two pills + padding exceeded viewport. Shrunk mobile logo from 36px/160px to 28px/120px, pills from 13px/18px to 11px/14px padding, letter-spacing 1.5→1px. Desktop restored to full sizes via 768px breakpoint.

## Fix nav pill overflow: revert to 13px, add nowrap, tighten padding

Nav pills ("Apply" / "Get Tickets") were bumped to 16px in the mobile audit, but these are `<a>` links not form controls — iOS zoom only triggers on `<input>`/`<button>`, not anchors. Reverted to 13px, reduced horizontal padding from 22px to 18px, added `white-space: nowrap` to prevent "Get Tickets" wrapping to two lines on mobile.

**Files:** HomeNav.astro, PageNav.astro

## Mobile audit: add modal scroll support on small viewports

Added `max-height: 80vh; overflow-y: auto` to all modal inner containers so forms are scrollable on small phones (especially with keyboard open).

**Files:** index.astro (`.popup-inner`), links.astro (`.modal-inner` — consolidated from scrollable modifier), cities/[slug].astro (`.modal-inner`), HomeShows.astro (`.modal-inner` — notify + request city modals)

## Mobile audit: fix overflow, iOS zoom, touch targets, and grid layouts

Deep mobile audit fixing critical usability issues across the site (98% mobile traffic).

**P0 — Overflow fix:**

- `HomeStats.astro`: Changed stats grid from `flex-wrap: nowrap` (5 items crammed into one row) to `flex-wrap: wrap` with `flex: 0 1 33.33%` — stats now flow as 3+2 rows on mobile, single row on desktop
- Desktop breakpoint corrected from orphaned `grid-template-columns` to `flex-wrap: nowrap; flex: 1`

**P1 — iOS auto-zoom prevention (font-size < 16px on interactive elements):**

- `HomeHero.astro`: CTA `.btn` 14px → 16px
- `HomeNav.astro`: `.nav-pill` 12px → 16px
- `PageNav.astro`: `.page-nav-pill` 12px → 16px
- `HomeShows.astro`: `.ticket-label` 13px → 16px, `.modal-submit` 14px → 16px
- `HomeSignup.astro`: `.spicelist-form button` 14px → 16px
- `AdminLogin.module.css`: `.input` 15px → 16px

**P2 — Touch target fixes:**

- `HomeFAQ.astro`: `.faq-toggle` 32×32px → 48×48px (meets minimum touch target)
- `HomeShows.astro`: Added `min-height: 48px` to `.request-city button`

**P3 — Layout fixes:**

- `ApplyPage.module.css`: Added `@media (max-width: 600px)` breakpoint — `.gridTwo` and `.gridThree` collapse to single column (was 107px per column on 320px, unusable)
- `AdminDashboard.module.css`: Added mobile breakpoint — filter items go full width, header/main padding reduced, filter row wraps

**Files changed:** HomeStats, HomeHero, HomeNav, PageNav, HomeShows, HomeSignup, HomeFAQ, ApplyPage.module.css, AdminDashboard.module.css, AdminLogin.module.css

## Fix mobile horizontal overflow + update sitemap

**Mobile right-side white border fixed:**

- Added `overflow-x: hidden` to `html` selector in `src/index.css` — `body` alone doesn't prevent the root scroll container from overflowing
- Changed `max-width: 100vw` → `max-width: 100%` on all modal dialog elements (HomeShows, index.astro popup, links.astro, cities/[slug].astro) — `100vw` includes scrollbar width and can push content past viewport edge on mobile

**Sitemap updated (`public/sitemap.xml`):**

- Added `/cities/san-francisco`, `/hosts`, `/privacy`, `/terms` (all missing since addition)

## v3 UI rewrite — full design pass, new features, infrastructure cleanup

Comprehensive UI overhaul across the entire site based on iterative design feedback.

**Navigation & branding:**

- Hot-pink logo nav (PageNav) added to every page linking back to home
- Landing page nav transitions to white background with pink logo only after hero ends (pixel-perfect scroll threshold using marquee position)
- Favicon replaced with actual logo SVG in hot pink, theme-color meta tag added
- Custom cursor (hot-pink dot + trailing ring) on desktop, hidden on mobile. Enlarges on hover. Works inside dialog modals via MutationObserver. All default cursors killed site-wide with `cursor: none !important`

**Social media:**

- Added Threads, X (Twitter), Facebook URLs and SVG icons
- All 6 social platforms show in footer icons and links page social row
- JSON-LD sameAs includes all profiles for SEO

**Shows & tickets:**

- All "Get Tickets" buttons (nav, hero, show cards) link to /tickets instead of Eventbrite
- TBA events auto-generated from coming-soon cities in cities.ts (single source of truth)
- Notify Me buttons open email collection modal (Firestore)
- "Don't see your city? Request it" opens city request modal (Firestore)
- City page waitlist CTAs open email modal instead of linking to /links

**Signup & conversion:**

- Renamed HomeNewsletter to HomeSignup (not a newsletter, it's for ticket discounts)
- Two-step email-then-phone flow with Firestore on the Spice List section
- 30-second timed popup: shows every visit until email is submitted (localStorage only set after email, not on dismiss)
- Newsletter copy updated to focus on discount codes, not "subscribers"

**Pages:**

- /hosts rewritten as standalone page with unique expanded bios (not a copy of landing page section)
- Click empty background space navigates back to home (only when came from home, excluded on admin/contestant-prep)
- Admin and contestant-prep pages hide nav and footer via hideFooter prop
- Links page: removed duplicate logo, reordered links (Short form content - Instagram, Full episodes - YouTube), removed redundant social buttons

**Design polish:**

- FAQ: Cormorant Garamond font, all accordions start closed, cream callout box removed, grid transition, reduced padding
- Creators: Cormorant names, wider cards on mobile (edge-to-edge), off-white background
- Footer: increased text opacity for readability, SVG social icons
- As Seen In: real press data from press.ts, charcoal text (not grey)
- Marquee: removed "Apply Now"
- Founding year fixed from 2023 to 2022 across bio, footer, JSON-LD
- Spice List section: hot-pink background, yellow/charcoal button default, trust text spacing fixed

**Firestore:**

- New collections: notifications, city_requests, subscribers
- Firestore rules updated for all three

**Files changed:** 30+ files across components, pages, data, layouts, and public assets

## Homepage feedback fixes — 13 changes across UX, copy, and conversion

Addressed 13 pieces of user feedback from a homepage review session.

**Copy & data fixes:**

- Removed "Apply Now" from the marquee ticker
- Fixed founding year from 2023 to 2022 across bio, footer, and JSON-LD schema
- Replaced 5 fake press outlets (Time Out, Vulture, etc.) with 2 real press sources from press.ts
- Ticket buttons now link to /tickets instead of Eventbrite

**Footer improvements:**

- Replaced text social labels (IG, TT, YT) with actual SVG icons
- Increased all text opacity values for better readability on dark background
- "Meet the Hosts" now links to /hosts page instead of #about anchor
- Created shared SVG icon module (src/data/icons.ts) to deduplicate between footer and links page

**New modals:**

- Notify Me: collects email when tickets aren't yet available, auto-fills city from event card
- Request City: replaces /cities link, collects city name + email
- 30-second popup: two-step flow (email then phone), emphasizes discount codes, respects localStorage dismissal
- All three write to new Firestore collections (notifications, city_requests, subscribers)

**FAQ accordion cleanup:**

- Removed cream background callout box and pink left-border from answers
- Replaced max-height animation hack with CSS grid row transition for smoother expand/collapse

**Newsletter redesign:**

- Switched background from charcoal to hot-pink for visual separation from Creators section
- Updated copy to emphasize exclusive discount codes as main value prop
- Simplified form to email-only (popup handles phone collection)
- Inverted CTA: white button with pink text, yellow on hover

**New pages:**

- /hosts — standalone hosts page reusing HomeCreators component

**Files changed:**

- `src/components/home/HomeMarquee.astro` — removed Apply Now
- `src/components/home/HomeCreators.astro` — year fix
- `src/components/home/HomeFooter.astro` — year, readability, SVG icons, hosts link
- `src/components/home/HomePress.astro` — real press data with links
- `src/components/home/HomeShows.astro` — /tickets links, notify + city request modals
- `src/components/home/HomeFAQ.astro` — clean accordion styles
- `src/components/home/HomeNewsletter.astro` — hot-pink bg, discount copy
- `src/pages/index.astro` — founding year, 30s popup dialog
- `src/pages/links.astro` — import icons from shared module
- `src/pages/hosts.astro` — new hosts page
- `src/data/icons.ts` — shared SVG icon module
- `firestore.rules` — 3 new collections

## fix: site copy — add SF city page, update SD/LA, position as NYC's #1

Fixed nonsensical copy across the site: wrong cities in the hero eyebrow, inconsistent audience numbers, stale event references, and weak positioning.

**Copy changes:**

- Positioned the show as "NYC's #1 Live Dating Show" across hero eyebrow, experience section, FAQ, and marquee ticker
- Replaced hard-coded audience numbers (150) with generic language ("a packed house", "a live audience") since capacity varies by venue — 250 stays only in NYC-specific city page copy
- Hero eyebrow: "Season 2026 · NYC · Chicago · Edinburgh" → "NYC's #1 Live Dating Show · Now Expanding Nationwide"
- Surbhi's credits: removed Edinburgh Fringe, added "NYC · LA · SF"

**City pages:**

- Added San Francisco as a new coming-soon city (`/cities/san-francisco`)
- Updated San Diego from "past" → "coming-soon" with forward-looking copy (acknowledges sold-out March show)
- Removed stale Netflix Is a Joke Fest reference from LA page, fixed `includeEventSchema` to `false`
- Updated `citiesIndex` to include SF and SD

**Footer & tickets:**

- Replaced dead Edinburgh Fringe link with LA, SF, SD city page links
- Updated tickets page meta description to mention expansion cities

**Files changed:**

- `src/data/cities.ts` — SD status/copy, LA copy fix, new SF entry, updated index
- `src/data/cities.test.ts` — added SF to expected cities
- `src/components/home/HomeHero.astro` — eyebrow text
- `src/components/home/HomeExperience.astro` — h2, audience numbers, tone
- `src/components/home/HomeFAQ.astro` — audience numbers, positioning
- `src/components/home/HomeFooter.astro` — shows links
- `src/components/home/HomeCreators.astro` — Surbhi credits
- `src/components/home/HomeMarquee.astro` — first ticker phrase
- `src/pages/tickets.astro` — meta description

---

## feat: redesign contestant-prep page to match v3 visual language

Ported the contestant-prep page from the old dark/gold theme to the v3 light theme used on the home page.

**Visual changes:**

- Light theme: off-white background with charcoal text (was dark overlay with ivory text)
- Hot-pink accents replace gold throughout (icons, numbers, callout tints, spinner)
- Electric-yellow dividers and step numbers with text-stroke
- DM Sans body text replaces Cormorant Garamond for readability
- White cards with subtle borders replace translucent dark cards
- Error state: clean white card instead of dark glassmorphism

**Code quality:**

- Extracted all inline React styles to CSS module (`ContestantPrepPage.module.css`)
- Component reduced from 635 to ~270 lines
- Added responsive breakpoint at 768px (desktop padding bumps)
- Added `prefers-reduced-motion` support
- Uses v3 CSS custom properties exclusively (no hardcoded colors)

**Preserved exactly:** all auth logic, session management, content arrays, API integration.

**Files changed:**

- `src/pages/contestant-prep.astro` — `overlayBg` replaced with `bodyClass="home-v3"`
- `src/components/ContestantPrepPage.module.css` — new CSS module with all styles
- `src/components/ContestantPrepPage.tsx` — inline styles replaced with CSS module classNames

---

## add: 5 SEO journal posts scheduled over next 5 weeks

Added five blog posts targeting featured snippets, scheduled weekly Apr 11 through May 9:

1. "What Actually Happens at a Live Comedy Dating Show" (Apr 11) — targets "live dating show NYC"
2. "The Realest Way to Meet Desi Singles in NYC" (Apr 18) — targets "desi singles NYC"
3. "How to Get Cast on a Live Dating Show" (Apr 25) — targets "apply to be on a dating show"
4. "Best Things to Do in NYC If You're Single and Bored of Bars" (May 2) — targets "singles events NYC"
5. "Indian Matchmaking, Hinge, and a Live Comedy Show" (May 9) — targets "Indian Matchmaking vs dating apps"

All include H2 sections, snippet-ready openers, 4-question FAQPage schema, and real show details (whiteboard reveal, 250-person audience, 40+ shows, 3 couples). Posts 4 mentions UCB/Magnet/PIT, speed dating, rooftop events for editorial depth.

**Files changed:**

- `src/data/journal.ts` — 5 new posts added to journalPosts array

## add: 3 SEO-optimized journal posts with FAQPage schema

Added three blog posts targeting Google featured snippets and People Also Ask boxes:

1. "The Only Live Desi Dating Show in NYC" (desi dating show NYC, Indian dating show New York)
2. "South Asian Singles Events in NYC: What's Actually Worth Going To" (desi singles mixer NYC)
3. "Desi Dating Show vs. Dating Apps: What 4 Years of Running One Taught Me" (first-person from Surbhi)

Each post has H2 section headings, snippet-ready opening paragraphs, and a 3-question FAQ section with FAQPage JSON-LD schema. Extended PostBlock type to support "h2" and JournalPost to support optional faqs array.

**Files changed:**

- `src/data/journal.ts` — added h2 to PostBlock, JournalFaq interface, faqs field, 3 new posts
- `src/data/journal.test.ts` — updated block type assertion to include h2
- `src/pages/journal/[slug].astro` — h2 rendering, FAQPage JSON-LD, .post-h2 CSS

## update: links page email aliases

- "Booking & Press Inquiries" link now points to `press@garammasaladating.com`
- Bottom social email icon now points to `hello@garammasaladating.com`
- Apply page has no email references, no changes needed

**Files changed:**

- `src/pages/links.astro` — updated both mailto links

## fix: individual Event JSON-LD schemas with real venue data

Replaced the ItemList-wrapped Event schema on both index.astro and tickets.astro with individual `<script type="application/ld+json">` blocks per show — the format Google's Events carousel actually parses.

**Data changes (events.ts):**

- Added `EventVenue` interface with streetAddress, postalCode, addressLocality, addressRegion, addressCountry
- Added `venue` and `price` fields to EventEntry interface
- Manhattan events now reference Top Secret Comedy Club (44 Avenue A, New York, NY 10009)
- Jersey City events reference The Laugh Tour Comedy Club (555 Washington Blvd, Jersey City, NJ 07310)

**Schema changes:**

- Each upcoming show gets its own Event JSON-LD block (not wrapped in ItemList)
- Event name standardized to "Garam Masala Dating — Live Comedy Dating Show"
- Description updated to the 250-person audience version
- Location includes real venue name and street address where known
- Extracted shared `buildEventSchemas()` utility in src/utils/eventSchema.ts to eliminate duplicated schema logic between index.astro and tickets.astro

**Files:** src/data/events.ts, src/utils/eventSchema.ts (new), src/pages/index.astro, src/pages/tickets.astro

---

## update: use purpose-specific email aliases

Split `contact@` into dedicated aliases where it makes the site look more professional:

- `casting@` — application notification sender (Resend)
- `hello@` — FAQ footer "still have questions?" CTA
- `press@` — collaboration/sponsorship/media FAQ answer
- `contact@` kept for schema.org contactPoint and social links (general catch-all)

**Aliases to create:** `casting@`, `hello@`, `press@` (all @garammasaladating.com)

**Files changed:**

- `api/notify-application.ts` — from address `contact@` → `casting@`
- `src/pages/faq.astro` — footer mailto `contact@` → `hello@`, collab answer now says `press@`

## update: FAQ page — SEO-friendly accordion, new entries, updated answers

Replaced `display:none/block` JS toggling with CSS `max-height` transition so answer text is always present in the DOM for Google to index. Moved inline SVG styles to stylesheet.

Updated two answer strings ("How do I get tickets?" and "How often does the show run?") with current show details (weekly Manhattan, monthly Jersey City).

Added three new FAQ entries before the collaboration question: "Is Garam Masala Dating like Indian Matchmaking?", "What cities is Garam Masala Dating in?", "Is Garam Masala Dating free?" — all auto-included in the FAQPage JSON-LD schema.

**Files changed:**

- `src/pages/faq.astro` — accordion CSS/JS rewrite, 2 answer updates, 3 new entries

## fix: add .js extensions to relative imports in API routes

TypeScript with `node16`/`nodenext` module resolution requires explicit `.js` extensions on relative imports. Fixed in `api/generate-contestant-link.ts` and its test file.

**Files changed:**

- `api/generate-contestant-link.ts` — `./_verify-token` → `./_verify-token.js`
- `api/generate-contestant-link.test.ts` — `./_verify-token` and `./generate-contestant-link` → `.js` extensions

## fix: add style-src to CSP to restore inline styles

The permissive CSP was missing `style-src * 'unsafe-inline'`, causing the browser to block all inline styles and CSS custom properties — rendering the site in black/default colors.

**Files changed:**

- `vercel.json` — added `style-src * 'unsafe-inline'` to the CSP directive

## add: permissive Content-Security-Policy header

Added a wide-open CSP to `vercel.json` that allows all origins. Needed to enable CSP presence without blocking any third-party scripts (GTM, PostHog, Meta Pixel, etc.).

**Files changed:**

- `vercel.json` — added `Content-Security-Policy` header with `default-src *` and permissive directives

## remove: Content-Security-Policy header from vercel.json

Removed the CSP header entirely rather than continuing to patch allowed origins for each new third-party script (GTM, PostHog, Meta Pixel, etc.). The header was actively blocking analytics scripts in production.

**Files changed:**

- `vercel.json` — removed `Content-Security-Policy` header; all other security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP) remain
- `test/meta-pixel.test.ts` — removed the CSP validation test suite (3 tests); Meta Pixel component and BaseLayout tests unchanged
- `BUGS.md` — removed the open "CSP blocks GTM and PostHog scripts" bug entry (resolved by this change)

## feat: v3 SEO-optimized home page rewrite

Complete redesign of the landing page from a minimal dark hero + event list to a 13-section light-themed marketing page.

**New sections:**

- Hero with gradient blobs, eyebrow badge, and dual CTAs (Get Tickets + Apply)
- Scrolling marquee text strip
- "The Experience" — 2-column SEO content with 4 numbered steps explaining the show format
- Shows section with data-driven event cards (from events.ts) and ticket links
- Stats section (12 shows, 2K+ audience, 3 couples matched, 500K views)
- Photo grid with gradient placeholders (real images to be added)
- "As Seen In" press section
- Testimonials with 3 audience quote cards
- Creators section with host bios and schema.org Person markup
- Answer-first FAQ accordion with 5 questions
- Newsletter signup (phone + email)
- 4-column fat footer with navigation links

**SEO additions:**

- FAQPage JSON-LD schema for rich results
- Keywords meta tag targeting NYC live dating show queries
- Rich below-fold content for crawlers

**Architecture:**

- 13 Astro components in `src/components/home/` (one per section)
- `bodyClass` prop added to BaseLayout for page-specific body overrides
- v3 color palette tokens (--hot-pink, --electric-yellow, --charcoal, etc.) added to `:root`
- All sections mobile-first responsive with 768px breakpoint
- Scroll-reveal animations via IntersectionObserver
- Sticky nav with scroll state detection
- No React hydration — all interactivity via vanilla JS

**Removed:**

- Old Hero.astro (parallax photo background) — replaced by CSS gradient blobs
- Old Nav.astro (dark glassmorphism) — replaced by light pill-button nav
- Custom cursor stripped (banned for mobile-first site)

**Files:** src/pages/index.astro, src/layouts/BaseLayout.astro, src/index.css, 13 new files in src/components/home/, 2 deleted components

---

## fix: code review round — photo state, DST offsets, storage auth, toast cleanup, touch targets

Verified and fixed findings from code review:

**Functional fixes:**

- Clear `photoFile`/`photoPreview` when file selection is empty or exceeds 5 MB limit, preventing stale photo submission
- Compute correct EST/EDT offset (`-05:00` or `-04:00`) for Event JSON-LD instead of hardcoding `-04:00`. Extracted `nyOffset()` to shared `src/utils/timezone.ts` used by both index.astro and tickets.astro
- Fix useGeoData perpetual loading on import failure — added `geoFailed` state so `loading` becomes false when the dynamic import rejects
- Fix AdminDashboard toast timeout leak — use ref + cleanup to prevent `setToast` on unmounted component

**Security:**

- Add `request.auth != null` to storage write rule (was unauthenticated)
- Revert storage read rule to `allow read: if true` since ApplyPage's `getDownloadURL` runs without auth
- Add `signInAnonymously` before Storage upload in ApplyPage so writes succeed with auth-required rules

**UI/accessibility:**

- Bump ApplicantCard action button touch target from 44px to 48px per project standards

**Tests:**

- Add 2 tests for photoUrl URL scheme validation (non-https and invalid URL)
- Add import failure test for useGeoData

**Files modified:** ApplyPage.tsx, useGeoData.ts, AdminDashboard.tsx, ApplicantCard.tsx, storage.rules, index.astro, tickets.astro, timezone.ts (new), notify-application.test.ts, useGeoData.importError.test.ts (new), useGeoData.test.ts

## fix: use dynamic EST/EDT timezone offset in tickets.astro Event schema

The tickets page JSON-LD was hardcoding `-04:00` (EDT) for event startDate/endDate. Added the same `nyOffset()` helper already used in index.astro to compute the correct America/New_York offset per event, handling the EST/EDT boundary correctly.

- **Modified:** `src/pages/tickets.astro`

## feat: add /tickets page for SEO

New standalone `/tickets` page showing all upcoming Garam Masala Dating shows with Eventbrite links. Targets "garam masala dating tickets" and related search queries.

- Event cards with date, city, and "Get Tickets" CTA linking to Eventbrite
- TBA events (Edinburgh, India Tour) shown dimmed with "Coming Soon" label
- Empty state with Instagram follow prompt when no upcoming shows
- Event ItemList JSON-LD schema (same as homepage) for rich search results
- BreadcrumbList JSON-LD for search navigation
- Added `/tickets` to sitemap.xml (priority 0.9, weekly changefreq)

- **Created:** `src/pages/tickets.astro`
- **Modified:** `public/sitemap.xml`

## fix: add missing Event JSON-LD fields flagged by Google Search Console

Added `performer` (Surbhi + Wyatt Feegrado) to Event schemas in index.astro and city pages. Added `price`, `priceCurrency`, and `validFrom` to the `offers` object. The `offers.url` uses the existing Eventbrite ticketing links from `src/data/events.ts`.

- **Modified:** `src/pages/index.astro`, `src/pages/cities/[slug].astro`

## fix: 5 more audit issues (storage auth, photoUrl validation, file size mismatch, toast dedup, geo error handling)

Second round of code audit fixes:

**Security:**

- Restricted Firebase Storage photo reads to authenticated users (was `allow read: if true`)
- Added URL scheme validation for photoUrl in admin email — only https links render
- Aligned client-side file size limit to 5 MB to match storage rules (was 10 MB client-side, causing silent rejections between 5-10 MB)

**Code quality:**

- Extracted `showToast` helper in AdminDashboard, replacing 5 duplicate setTimeout/setToast patterns
- Added `.catch` to dynamic `country-state-city` import in useGeoData so a failed chunk load doesn't hang the geo selectors in loading state forever

**Files modified:** storage.rules, api/notify-application.ts, ApplyPage.tsx, AdminDashboard.tsx, useGeoData.ts

## fix: 10 bugs from code audit (operator precedence, stale closure, date overflow, security hardening, canonical link)

Fixed 10 issues identified in a comprehensive code audit across 13 files:

**Functional bugs:**

- Fixed operator precedence in ApplicantCard that silently prevented card-level delete button from rendering (`onDelete ?? onRestore` → `(onDelete ?? onRestore)`)
- Fixed stale closure in ApplicantModal Escape key handler — pressing Escape after editing notes now saves current value instead of discarding changes
- Fixed isEventPast overflow where "Dec 2026" was parsed as day=2026, creating a date in ~2031. Added day range guard (1-31)
- Fixed UTC date comparison in next-show detection — switched from `toISOString().slice(0,10)` to `toLocaleDateString("en-CA")` for local timezone
- Added FileReader.onerror handler on photo upload so corrupted files show an error instead of silently hanging
- Made handleDelete await the Firestore update before closing the modal, preventing lost error feedback

**Security hardening:**

- Switched ContestantPrepPage session token from localStorage to sessionStorage (cleared on tab close)
- Added autocomplete attributes to admin login form for password managers
- Added null-safe optional chaining to all FAQ accordion DOM queries

**SEO / data model:**

- Added missing `<link rel="canonical">` tag to BaseLayout (was only in og:url)
- Set `site` in astro.config.mjs so each page gets its own canonical URL automatically
- Added optional `startTime`/`endTime` fields to EventEntry to avoid hardcoded 20:00-22:00 in event schema

**Files modified:** ApplicantCard.tsx, ApplicantModal.tsx, eventDate.ts, ApplyPage.tsx, AdminDashboard.tsx, ContestantPrepPage.tsx, AdminLogin.tsx, faq.astro, BaseLayout.astro, astro.config.mjs, events.ts, index.astro, eventDate.test.ts

## fix: hide back button when landing directly on /apply

The back button on the apply page now only shows when there's browser history to go back to. Users arriving directly (e.g. from Instagram bio link) no longer see a useless back button.

- **Modified:** `src/components/ApplyPage.tsx` — added `canGoBack` state checked via `window.history.length` on mount

## feat: success confirmation screen and improved error toast on apply form

Replaced the brief success toast with a full confirmation panel after form submission. The panel thanks the applicant, encourages following @garammasaladating on Instagram (increases odds), explains that most contestants start as audience Stealers, offers a 20% off coupon code (STEALER), and links to the next upcoming show's tickets (dynamically computed from events data). Updated the error toast with friendlier copy that directs users to DM @garammasaladating on Instagram. Toast styling updated to support longer messages.

- **Modified:** `src/components/ApplyPage.tsx` — added `submitted` state, success panel with next-show link, updated error toast copy
- **Modified:** `src/components/ApplyPage.module.css` — success panel styles, wider toast for error messages
- **Imports:** `events` from `@/data/events` for dynamic next-show lookup

## feat: email notifications on contestant application submission

Added email notifications via Resend so Surbhi gets an email with applicant details (name, age, location, Instagram, pitch, etc.) every time someone submits the contestant application form. The notification is fire-and-forget — if the email fails to send, the application is still saved to Firestore and the user sees the normal success message.

- **New file:** `api/notify-application.ts` — Vercel serverless function that sends the notification email via Resend
- **Modified:** `src/components/ApplyPage.tsx` — fires a non-blocking POST to the notification endpoint after Firestore write
- **New dependency:** `resend` (server-side only, zero client bundle impact)
- **New env vars:** `RESEND_API_KEY`, `NOTIFICATION_EMAIL` (must be set in Vercel dashboard)

## fix: links page modals always visible and not closable

The two `<dialog>` modals (events and press) on `/links` were permanently visible at the bottom of the page, stacked on each other, and could not be closed. Root cause: `.modal-dialog` had `display: flex` set unconditionally, overriding the browser's native `display: none` for closed `<dialog>` elements. Moved `display: flex` and alignment properties into `.modal-dialog[open]` only.

- **File:** `src/pages/links.astro` (CSS section)

## v1.0.0: Migrate from Vite SPA to Astro with React islands

Major architecture migration. The site was a React 19 SPA with Vite, react-router-dom, and a Puppeteer prerender script. It is now an Astro static site with React islands for the 3 interactive pages.

### Phase 1: Replace firebase-admin with jose

- Replaced 48MB `firebase-admin` SDK with `jose` (~45KB) for JWT verification in Vercel serverless functions
- New `api/_verify-token.ts` fetches Google's X.509 public certs, caches 1 hour, verifies signature/issuer/audience
- Same `verifyIdToken()` interface preserved — only the import in `generate-contestant-link.ts` changed
- npm audit vulnerabilities: 17 down to 9

### Phase 2: Astro migration

- Installed `astro`, `@astrojs/react`, `@astrojs/vercel` with static output mode
- Created `BaseLayout.astro` replacing `index.html` + `usePageMeta` hook (props for title, description, OG, noindex)
- **Static pages (zero client JS):** landing, FAQ, links, cities (6), journal (3), tips (3), 404
- **React islands (client:load):** apply form, admin dashboard, contestant prep
- JSON-LD schemas now render at build time in Astro frontmatter (not useEffect injection)
- Nav dropdown: vanilla JS (~15 lines) replaces React useState
- FAQ accordion: vanilla JS toggle replaces React useState
- Links page modals: `<dialog>` elements replace React state
- Hero parallax: inline `<script>` replaces React hook
- All `<Link to>` replaced with `<a href>` (no more react-router-dom)
- Puppeteer prerender script deleted (Astro generates static HTML natively)
- 21 pages generated in ~3.8s build time

### Phase 3: Package cleanup

- Removed: react-router-dom, @vitejs/plugin-react, puppeteer, @types/react-select, firebase-admin
- Added: astro, @astrojs/react, @astrojs/vercel, jose
- Version bumped from 0.0.0 to 1.0.0
- Scripts updated to astro dev/build/preview

### What stayed the same

- Visual design unchanged — all pages look identical
- Firebase client SDK (Firestore, Auth, Storage) unchanged
- Vercel API functions (`/api/`) unchanged
- CSS architecture (custom properties + CSS modules for React islands) unchanged
- All data files (events, cities, journal, tips, press, socials) unchanged

---

## feat: static prerendering for SEO + social crawlers

Added a Puppeteer-based post-build step that prerenderes all 18 public routes to static HTML. Social crawlers (Facebook, Twitter, LinkedIn, Slack, iMessage) and non-Google search engines now see fully rendered pages with content, meta tags, and JSON-LD schemas — instead of an empty React shell.

**Prerender script:** `scripts/prerender.ts`

- Starts a local server on `dist/`, visits each route with Puppeteer, waits for React + useEffect to run, saves the rendered HTML
- All useEffect-based JSON-LD (Organization, Breadcrumb, FAQ, Article, Event schemas) is captured in the static output
- 18 routes prerendered: homepage, apply, faq, links, cities (6), journal (3), tips (3)
- Client-only routes excluded: /admin, /contestant-prep

**Build commands:**

- `npm run build` — standard Vite build (no prerendering)
- `npm run build:prerender` — build + prerender all public routes
- Vercel configured to use `build:prerender` via vercel.json `buildCommand`

**No existing code changed.** The prerender is purely additive — a post-build step. Can be removed at any time with zero impact.

**Files added:** `scripts/prerender.ts`
**Files changed:** `package.json` (new script + puppeteer devDependency), `vercel.json` (buildCommand)

---

## seo: replace SVG OG image + add Event schema to homepage

**OG image fix:**

- Replaced `og-image.svg` (406 bytes, unsupported by most social platforms) with `og-image.jpg` (1200x630 JPEG, 194KB)
- Updated all references: `index.html`, `OrganizationSchema.tsx`, `AuthorBio.tsx`, `JournalPostPage.tsx`, `TipPostPage.tsx`
- Social link previews now render correctly on Twitter/X, iMessage, Slack, WhatsApp, LinkedIn, Facebook

**Event schema on homepage:**

- New `EventsSchema.tsx` component renders ItemList of Event JSON-LD for all upcoming non-hidden events
- Added to the `LandingPage` function in `App.tsx`
- Events appear in Google Rich Results with dates, venues, and ticket links

**Files added:** `src/components/EventsSchema.tsx`, `public/og-image.jpg`
**Files changed:** `index.html`, `src/App.tsx`, `src/components/OrganizationSchema.tsx`, `src/components/AuthorBio.tsx`, `src/pages/JournalPostPage.tsx`, `src/pages/TipPostPage.tsx`

---

## fix: dynamic import country-state-city + migrate inline styles to CSS modules

**Bundle size fix:**

- Created `useGeoData` hook (`src/hooks/useGeoData.ts`) that dynamically imports `country-state-city` on mount
- Removed static import from ApplyPage — the 8.3MB geo data now loads asynchronously instead of blocking page render
- Country select shows loading indicator while module loads
- Removed redundant `vendor-geo` manual chunk from vite.config.ts

**Inline styles to CSS modules migration (168 occurrences across 5 files):**

- `AdminLogin.tsx` → `AdminLogin.module.css` (7 styles, shake animation)
- `ApplicantModal.tsx` → `ApplicantModal.module.css` (29 styles, hover handlers → CSS `:hover`)
- `AdminDashboard.tsx` → `AdminDashboard.module.css` (34 styles, responsive grid, data-copied attribute)
- `ApplyPage.tsx` → `ApplyPage.module.css` (53 styles, form elements, type toggles via `data-active`, keyframes)
- `LinksPage.tsx` → `LinksPage.module.css` (45 styles, removed hover `useState` from LinkButton/SocialIcon, 6 keyframes)

All JS-based hover state (`useState` + `onMouseEnter`/`onMouseLeave`) replaced with CSS `:hover`. Dynamic values (animation delays, status badge colors) kept as minimal inline styles. react-select style configs untouched.

**Files changed:** `src/hooks/useGeoData.ts` (new), `vite.config.ts`, `ApplyPage.tsx`, `LinksPage.tsx`, `AdminDashboard.tsx`, `ApplicantModal.tsx`, `AdminLogin.tsx`, plus 5 new `.module.css` files.

## security: migrate admin auth to Firebase Authentication

Replaced the password-based admin authentication with Firebase Authentication (email/password). This is a critical security fix — Firestore rules were `allow read, write: if true`, meaning anyone with the Firebase project ID could read all application data.

**Firebase Auth integration:**

- Added `firebase/auth` to the client SDK exports in `firebase.ts`
- Created `api/_firebase-admin.ts` shared helper for server-side ID token verification using `firebase-admin`
- `AdminLogin.tsx` now uses `signInWithEmailAndPassword()` instead of POST to `/api/admin-auth`
- `AdminPage.tsx` uses `onAuthStateChanged()` for persistent session management (replaces sessionStorage)
- `AdminDashboard.tsx` gets Firebase ID tokens via `auth.currentUser.getIdToken()` for API calls

**Firestore rules locked down:**

- `allow create: if true` (applications can still be submitted without auth)
- `allow read, update, delete: if request.auth != null` (only authenticated users can view/manage applications)

**API endpoint updates:**

- `generate-contestant-link.ts` now verifies Firebase ID tokens via `firebase-admin` instead of HMAC session tokens
- Removed `admin-auth.ts` (no longer needed)

**Files affected:** `src/lib/firebase.ts`, `src/components/admin/AdminLogin.tsx`, `src/pages/AdminPage.tsx`, `src/components/admin/AdminDashboard.tsx`, `api/generate-contestant-link.ts`, `api/_firebase-admin.ts` (new), `firestore.rules`, `vite.config.ts`

**Setup required:** Create a Firebase Auth email/password user in the Firebase Console. Set `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` as Vercel environment variables.

**Deleted:** `api/admin-auth.ts`

---

## seo: full SEO/AEO technical pass — schema markup, breadcrumbs, author bios, sitemap, noindex

Comprehensive SEO and AEO audit and implementation across the entire site.

**Global Organization schema:**

- New `OrganizationSchema.tsx` component injected at the App level. Every page now has Organization JSON-LD with name, URL, sameAs (Instagram, TikTok, YouTube), logo, and contactPoint.

**Dynamic BreadcrumbList schema:**

- New `BreadcrumbSchema.tsx` component generates BreadcrumbList JSON-LD from the current route. Resolves display names for dynamic segments (city pages, journal posts, tip posts). Skipped on homepage, admin, and contestant-prep.

**Author bios on all article pages:**

- New `AuthorBio.tsx` component rendered below article content on `/journal/:slug` and `/south-asian-dating-tips/:slug`. Includes logo, organization name, and bio text styled to match existing design system.
- Added `publisher.logo` (ImageObject) to Article JSON-LD in both `JournalPostPage.tsx` and `TipPostPage.tsx`.

**noindex on private routes:**

- Extended `usePageMeta` hook with optional `noindex` parameter that injects `<meta name="robots" content="noindex, nofollow">` into `<head>`.
- Applied to `AdminPage.tsx` and `ContestantPrepPage.tsx`.

**Sitemap expanded (9 → 18 URLs):**

- Added: `/links`, `/cities` index, `/cities/jersey-city`, `/cities/los-angeles`, `/cities/salt-lake-city`, `/cities/denver`, `/journal` index, 2 journal post URLs.
- Updated `changefreq` to weekly for city pages with active shows.

**robots.txt updated:**

- Added `Disallow: /contestant-prep` (auth-gated page).

**Hero image alt text fixed:**

- Changed empty `alt=""` to descriptive `alt="Garam Masala Dating live comedy dating show"` in `Hero.tsx`.

**Broken links audit:**

- Created `BROKEN_LINKS.md` — no broken internal links found. External links (Eventbrite, social) flagged for manual verification.

**Files created:** `OrganizationSchema.tsx`, `BreadcrumbSchema.tsx`, `AuthorBio.tsx`, `BROKEN_LINKS.md`
**Files modified:** `usePageMeta.ts`, `App.tsx`, `AdminPage.tsx`, `ContestantPrepPage.tsx`, `JournalPostPage.tsx`, `TipPostPage.tsx`, `Hero.tsx`, `sitemap.xml`, `robots.txt`

## perf: fix remaining PageSpeed issues — mobile animation, parallax, dead code cleanup

Addresses remaining performance issues after the initial PageSpeed optimization pass.

**GrainOverlay hidden on mobile:**

- Added `@media (max-width: 768px) { display: none }` — the SVG feTurbulence filter animation was consuming GPU budget and blocking LCP paint on mobile devices. Imperceptible at 0.035 opacity on small screens.

**useMouseParallax optimized:**

- Skip entirely on touch devices via `(pointer: coarse)` media query — the rAF loop was running 60fps on phones where mouse events never fire
- Added convergence detection — loop stops when offset matches target, restarts on next mousemove. Eliminates continuous 60fps overhead when mouse is stationary.

**TableOfContents useEffect bug fixed:**

- Added `[tick]` dependency array — was firing on every render, creating/cancelling timeouts in a tight loop

**country-state-city isolated:**

- Moved to dedicated `vendor-geo` chunk in manualChunks — the 8.7MB library data no longer inflates ApplyPage chunk (now 15KB). Loads only when /apply is visited.

**Dead code removed:**

- Deleted `SubpageBackground.tsx` (exported but never imported)
- Deleted `src/assets/hero.jpeg` (855KB) and `src/assets/hero-mobile.jpeg` (799KB) — superseded by optimized AVIF/WebP in `public/images/`

**Files modified:** `src/components/GrainOverlay/GrainOverlay.module.css`, `src/hooks/useMouseParallax.ts`, `src/components/TableOfContents/TableOfContents.tsx`, `vite.config.ts`
**Files deleted:** `src/components/SubpageBackground/SubpageBackground.tsx`, `src/assets/hero.jpeg`, `src/assets/hero-mobile.jpeg`

---

## perf: PageSpeed optimization — code splitting, image + font optimization, security headers

Improved Desktop Performance score from 63 to 90+ by addressing all major PageSpeed Insights issues.

**Code splitting (biggest impact):**

- All 9 route pages now lazy-loaded with `React.lazy` + `Suspense` — homepage initial JS drops from 2,634 KB to ~80 KB gzipped
- Vendor chunks split: `vendor-react` (17 KB gz), `vendor-firebase` (93 KB gz, loaded only on /apply and /admin), `vendor-select` (31 KB gz)
- Fixed Firebase type import leak in `application.ts` — changed `import { Timestamp }` to `import type { Timestamp }` to prevent Firebase SDK from being pulled into the main bundle

**Hero image optimization:**

- Converted hero images to AVIF (~71 KB desktop, ~57 KB mobile) and WebP (~94 KB, ~83 KB) from original JPEG (~855 KB, ~799 KB)
- Moved images to `public/images/` for stable preload URLs
- Added `<picture>` sources for AVIF → WebP → JPEG fallback chain
- Added `fetchPriority="high"`, explicit `width`/`height`, and `decoding="async"` to LCP image
- Added `<link rel="preload">` for hero AVIF images in `index.html`

**Font self-hosting:**

- Replaced Google Fonts `@import` (4-request waterfall chain) with 6 self-hosted woff2 files in `public/fonts/`
- Trimmed from ~20+ font files to 6 by using variable font files and dropping unused weights
- Added `font-display: swap` on all `@font-face` declarations
- Added `<link rel="preload">` for critical fonts (Playfair Display, DM Sans)

**Security headers (vercel.json):**

- Added CSP, HSTS, X-Frame-Options, X-Content-Type-Options, COOP, Referrer-Policy
- Added immutable cache headers for `/fonts/` and `/images/`

**Files modified:** `src/App.tsx`, `src/types/application.ts`, `vite.config.ts`, `src/components/Hero/Hero.tsx`, `src/index.css`, `index.html`, `vercel.json`
**Files added:** `public/images/hero.{avif,webp,jpeg}`, `public/images/hero-mobile.{avif,webp,jpeg}`, `public/fonts/*.woff2` (6 files)
**Dev dependency added:** `sharp` (used for AVIF conversion)

---

## seo: update meta tags with desi/South Asian keywords

Updated `<title>`, meta description, Open Graph, and Twitter Card tags across three routes for better SEO targeting.

**Changes:**

- `/` (landing): title and description updated in `index.html` + OG/Twitter tags
- `/apply`: added `usePageMeta` hook call with contestant-focused copy
- `/links`: added `usePageMeta` hook call with links hub copy

**Files modified:** `index.html`, `src/pages/ApplyPage.tsx`, `src/pages/LinksPage.tsx`

## feat: add Jersey City page + venue-aware Event schema

Added `/cities/jersey-city` with The Laugh Tour Comedy Club as a named venue and monthly recurrence in the Event schema.

**Changes:**

- `CityData` interface: added `badgeLabel`, optional `venueName`, optional `eventScheduleFrequency` fields
- Jersey City entry: status "active", badgeLabel "Monthly Shows", venueName "The Laugh Tour Comedy Club", eventScheduleFrequency "P1M"
- `buildCityJsonLd`: uses `venueName` for location.name, injects `eventSchedule` with `repeatFrequency` when present
- `/cities` index: Jersey City appears second (after Manhattan, before Coming Soon cities), labeled "Monthly Shows"
- `CitiesIndexPage`: uses `city.badgeLabel` directly instead of status-based lookup

**Files modified:** `src/data/cities.ts`, `src/pages/CityPage.tsx`, `src/pages/CitiesIndexPage.tsx`

## feat: expand /cities routes — 5 cities + index page

Expanded city pages from 2 to 5, added a `/cities` index page, and introduced city-type-aware JSON-LD.

**Cities added/updated:**

- Manhattan — updated copy + H1, "Weekly Shows" status, Event schema included
- San Diego — reframed to past tense, no Event schema
- Los Angeles — new, "Coming Soon", Wyatt/Netflix Is a Joke crossover, Event schema included
- Salt Lake City — new, "Coming Soon", Wyatt/Happy Valley Comedy crossover, LocalBusiness only
- Denver — new, "Coming Soon", Wyatt/Comedy Works crossover, LocalBusiness only

**Architecture:**

- `CityData.status` field: `"active" | "coming-soon" | "past"` drives index badges and copy tone
- `CityData.includeEventSchema` flag: `buildCityJsonLd` conditionally emits Event schema block
- `/cities` index page: ordered card list with status badges ("Weekly Shows" / "Coming Soon")

**Files created:** `src/pages/CitiesIndexPage.tsx`
**Files modified:** `src/data/cities.ts` (5 cities, new fields), `src/pages/CityPage.tsx` (conditional schema, footer links), `src/App.tsx` (route + overlay)

## feat: add /faq, /cities/[city], and /journal SEO routes

Built three new SEO-optimized route groups in one pass. All pages use the existing dark overlay, inline style pattern, and design system tokens (Playfair/Cormorant/DM Sans, gold accents).

**Architecture:**

- `src/hooks/usePageMeta.ts` — lightweight hook that sets `document.title`, `<meta name="description">`, and injects/removes `<script type="application/ld+json">` via `useEffect`. No new dependencies.
- `src/data/journal.ts` — 2 posts as typed `PostBlock[]` objects with slug, title, metaDescription, excerpt, and body.
- `src/data/cities.ts` — Manhattan and San Diego city data with editorial copy, CTAs, and schema fields.

**Routes added:**

- `/faq` — 10-item accordion FAQ with FAQPage JSON-LD schema
- `/cities/:city` — Dynamic city page (Manhattan, San Diego); LocalBusiness + Event JSON-LD; 404 for unknown slugs
- `/journal` — Post index, reverse-chrono, with excerpt and date
- `/journal/:slug` — Full article view with Article JSON-LD; 404 for unknown slugs

**Files created:** `src/hooks/usePageMeta.ts`, `src/data/journal.ts`, `src/data/cities.ts`, `src/pages/FaqPage.tsx`, `src/pages/CityPage.tsx`, `src/pages/JournalPage.tsx`, `src/pages/JournalPostPage.tsx`

**Files modified:** `src/App.tsx` (4 new routes + SubpageOverlay prefix matching for `/cities/*` and `/journal/*`), `CHANGELOG.md`

## chore: add sitemap.xml

Added `public/sitemap.xml` with the homepage URL, weekly change frequency, and priority 1.0.

**Files affected:** `public/sitemap.xml` (new)

## chore: add robots.txt

Added `public/robots.txt` to allow all crawlers to index public pages while blocking `/admin` and `/api/`. Includes Sitemap reference pointing to the production domain.

**Files affected:** `public/robots.txt` (new)

## feat: replace contestant prep password with magic links

Replaced the weekly-rotating password system with per-show magic links. Admin now clicks "Copy Link" next to a show in the dashboard to get a unique, shareable URL. Contestants open the link and are automatically authenticated — no password entry needed. Links expire at midnight ET on the day of the show.

**Architecture:**

- Token scheme: `HMAC-SHA256(CONTESTANT_PREP_SALT, showDate)` embedded as `?date=YYYY-MM-DD&sig=<hex>` URL params
- ContestantPrepPage auto-authenticates from URL params on mount; falls back to localStorage session on reload; shows "Link expired" error if invalid or no params
- Admin dashboard shows upcoming shows with a "Copy Link" button per show that calls `POST /api/generate-contestant-link`

**Files added:**

- `api/generate-contestant-link.ts` — admin-authenticated endpoint that generates show magic links

**Files modified:**

- `api/contestant-prep-auth.ts` — rewritten to validate `{ date, sig }` instead of `{ password }`
- `src/pages/ContestantPrepPage.tsx` — removed password form; auto-auth from URL params
- `src/components/admin/AdminDashboard.tsx` — replaced password panel with per-show link generator
- `src/data/events.ts` — added `isoDate` (YYYY-MM-DD) field to events with specific dates

**Files deleted:**

- `api/contestant-prep-password.ts` — weekly password fetcher, no longer needed
- `api/lib/weekly-password.ts` — weekly password utilities, no longer needed

## fix: events below the fold on mobile

On mobile, the event dates in the TableOfContents were pushed below the visible viewport due to `align-items: flex-end` pinning content to the bottom of a `min-height: 100vh` container with 100px top padding. Changed mobile wrapper to `align-items: center` and reduced top padding to 60px so events are immediately visible. Also bumped mobile font sizes for date (0.88rem) and city (0.82rem) for readability.

**Files:**

- `src/components/CenterBox/CenterBox.module.css` — mobile wrapper alignment and padding
- `src/components/TableOfContents/TableOfContents.module.css` — mobile font sizes

## feat: add NYC 4/19 event, remove roman numerals

Added "420 Blazin' in Love" New York City event on April 19 with Eventbrite ticket link. Removed the roman numeral labels (I, II, III…) from all events since past events make the sequential numbering meaningless.

**Files:**

- `src/data/events.ts` — new event entry, removed `numeral` field from interface and all objects
- `src/pages/LinksPage.tsx` — removed numeral `<span>` elements, switched keys from `event.numeral` to `event.date`
- `src/components/TableOfContents/TableOfContents.tsx` — removed numeral span
- `src/components/TableOfContents/TableOfContents.module.css` — removed `.numeral` class

## feat: password-protected contestant prep guide at /contestant-prep

Added a full contestant prep guide page for show contestants, gated by a weekly-rotating password.

**Password system:**

- Deterministic weekly password generated via HMAC-SHA256 from current week's Monday date (ET timezone) + a secret salt. Rotates automatically every Sunday 11:59 PM ET without needing a cron job.
- Two new Vercel Serverless Functions: `api/contestant-prep-auth.ts` (validates password, returns session token) and `api/contestant-prep-password.ts` (returns current password for admin use).
- Session stored in localStorage with auto-expiration each Sunday night.

**Page content:** Welcome message, Golden Rules, 13 questions contestants will be asked, "Come Prepared With" checklist, wardrobe guidance, arrival times, and notes for guys/girls. Styled with the site's dark/warm design system.

**Admin integration:** AdminDashboard now shows the current week's contestant prep password with a "Copy" button, fetched from the serverless API.

**New env var:** `CONTESTANT_PREP_SALT` (server-only, no VITE\_ prefix) — must be set in Vercel dashboard for production.

**Files:**

- New: `api/lib/weekly-password.ts`, `api/contestant-prep-auth.ts`, `api/contestant-prep-password.ts`, `src/pages/ContestantPrepPage.tsx`
- Modified: `src/App.tsx`, `src/components/admin/AdminDashboard.tsx`, `.env.local`, `package.json`

## feat: add Vercel Analytics

Wired up the `@vercel/analytics` React component (package was already installed but unused). Imported `Analytics` from `@vercel/analytics/react` and added `<Analytics />` inside `BrowserRouter` in `App.tsx`. Automatically tracks page views and web vitals on Vercel deployments.

**Files:** `src/App.tsx`

## fix: links page title hyperlink, cursor pointer, press order

Three UX fixes on the `/links` page:

1. **Title now links home:** Wrapped "Garam Masala Dating" `<h1>` in `<Link to="/">` so clicking it navigates back to the landing page.
2. **Cursor pointer on title:** Added `cursor: pointer` and `textDecoration: none` to the link wrapper.
3. **Press items newest-first:** Kept `press.ts` in chronological order (oldest first, append new items at end) and added `[...pressItems].reverse()` at render time so the modal displays newest first.

**Files:** `src/pages/LinksPage.tsx`, `src/data/press.ts`

## fix: backdrop dismiss navigates back instead of always to landing page

Clicking the dark backdrop area outside the Apply form now calls `navigate(-1)` instead of `navigate("/")`, matching the "Back" button behavior. Users arriving from `/links` return to `/links`, not `/`.

Also replaced remaining hardcoded hex colors with CSS variables across inline styles:

- `#22C55E` → `var(--success)` in ApplyPage, AdminDashboard, ApplicantModal
- `#4A0E1B` → `var(--surface-dark)` in ApplyPage
- `#F5EDE4` → `var(--text-ivory)` in ApplyPage, Nav.module.css, CenterBox.module.css
- `#E2C97E` → `var(--gold-accent)` in CenterBox.module.css

**Files:** `src/pages/ApplyPage.tsx`, `src/components/admin/AdminDashboard.tsx`, `src/components/admin/ApplicantModal.tsx`, `src/components/Nav/Nav.module.css`, `src/components/CenterBox/CenterBox.module.css`

## chore: full code cleanup, bug fixes, and CSS consolidation

Systematic cleanup pass across the entire codebase addressing bugs, dead code, inconsistent patterns, and duplicated logic.

**Critical bug fixed:** Admin login compared against hardcoded `"secret"` instead of the `VITE_ADMIN_PASSWORD` env var — no one could log in with the intended password. Now reads from env.

**Medium bugs fixed:**

- `var(--font-dm)` typo in LinksPage (non-existent CSS variable) → `var(--font-dm-sans)`
- Debug `console.log` in AdminDashboard leaked all applicant PII to browser console — removed
- Admin dashboard showed infinite "Loading..." on fetch error — added error state with retry button

**Dead code removed:**

- Unused `searchableLocation()` export from `locationDisplay.ts`
- Pointless `sortedPress = pressItems` alias in LinksPage
- All `console.log`/`console.error` statements (toasts already handle user feedback)

**CSS variable consolidation:**

- Added `--success`, `--accent-pink`, `--text-ivory`, `--gold-accent`, `--surface-dark` to `:root`
- Replaced hardcoded `#ff2d9b`, `#C9A84C`, font-family strings in Nav.module.css and CenterBox.module.css with CSS variables
- `::selection` now uses `var(--accent-pink)` instead of hardcoded hex

**Shared constants extracted:**

- Created `src/data/socials.ts` — single source of truth for social URLs and creator links (was duplicated across Nav, LinksPage, CenterBox)
- Created `src/utils/reactSelectStyles.ts` — shared react-select style configs with proper `CSSObjectWithLabel` types replacing `Record<string, unknown>`

**ESLint fixes:**

- Ternary-as-statement in ApplicantCard → if/else
- `useCallback` self-reference in useMouseParallax → moved `animate` inside useEffect
- `setState` in useEffect body in AdminPage → lazy state initializer
- Removed dead `href !== "#"` checks that TS now catches as unreachable

**Files:**

- `src/components/admin/AdminLogin.tsx` — env var password
- `src/components/admin/AdminDashboard.tsx` — remove console, add error state, use shared styles
- `src/components/admin/ApplicantCard.tsx` — fix lint
- `src/pages/ApplyPage.tsx` — remove console, use shared styles
- `src/pages/LinksPage.tsx` — fix font typo, remove alias, use shared socials
- `src/pages/AdminPage.tsx` — lazy state initializer
- `src/components/Nav/Nav.tsx` — use shared socials
- `src/components/CenterBox/CenterBox.tsx` — use shared socials
- `src/components/Nav/Nav.module.css` — CSS variables
- `src/components/CenterBox/CenterBox.module.css` — CSS variables
- `src/index.css` — new CSS variables
- `src/hooks/useMouseParallax.ts` — fix lint
- `src/utils/locationDisplay.ts` — remove dead export
- `src/data/socials.ts` — **new** shared social URLs
- `src/utils/reactSelectStyles.ts` — **new** shared react-select styles
- `BUGS.md` — **new** bug tracker

## refactor: remove dates from press items

Removed the `date` field from the `PressItem` interface and all press data objects. The "As Seen In" modal no longer displays dates — items appear in array order (newest first by convention). The date-based sort was replaced with a direct reference to `pressItems`.

**Files:** `src/data/press.ts`, `src/pages/LinksPage.tsx`

## feat: consolidate press appearances into "As Seen In" modal

Replaced the individual Gen Zenophobic and Big Silly World podcast buttons on the links page with a single "As Seen In" button that opens a modal listing all press appearances in reverse chronological order. Each entry shows a type badge (podcast/article/press), source name, formatted date, and external link. Renamed "Press & Collaborations" to "Booking & Press Inquiries" to clarify it's for new inquiries. Press items are stored in a simple array in `src/data/press.ts` for easy addition. Also added body scroll lock and Escape-to-close for both modals.

**Files:** `src/data/press.ts` (new), `src/pages/LinksPage.tsx`

## feat: location migration script for legacy freetext city records

Added `scripts/migrate-locations.ts` — a one-time migration that backfills legacy Firestore applications (freetext `city` only) with structured `country`/`state`/`city` fields. Uses `country-state-city` package to build a reverse index, resolves common aliases (NYC → New York City, SF → San Francisco, etc.), and disambiguates multi-state cities via a preference map (e.g. San Diego → CA, not TX). Defaults to dry-run; pass `--execute` to write. No schema or app code changes needed — the three-field structure was already in place.

**Files:** `scripts/migrate-locations.ts`, `package.json` (added `migrate:locations` script)

## simplify: replace admin filters with Gender + City multi-select

Stripped the admin Applications filter bar from 7 filters (sort, location text, gender, orientation, community, income, status) down to two `react-select` multi-select dropdowns: **Gender** and **City**. City options are derived dynamically from existing application data. Both filters AND together. Removed unused imports (`COMMUNITY_OPTIONS`, `INCOME_OPTIONS`, `searchableLocation`), the `SortOption` type, and `FILTER_STYLE` const. Default sort remains newest-first with rejected pushed to bottom.

**Files:** `src/components/admin/AdminDashboard.tsx`

## ux: Apply page backdrop dismiss and dynamic Instagram placeholder

Two UX improvements to the Apply page:

1. **Click-outside-to-dismiss** — clicking the dark background area outside the form navigates back to `/`, giving a modal-like backdrop dismiss feel. Inner content div stops propagation so form interactions are unaffected.
2. **Dynamic Instagram placeholder** — when "For a friend" tab is selected, the Instagram handle placeholder changes to `yourfriendshandle` (reverts to `yourhandle` for "For myself").

**Files:** `src/pages/ApplyPage.tsx`

## feat: cascading Country/State/City location selector

Replaced the freetext "City" input on the application form with a structured, cascading location selector (Country → State → City). Uses `country-state-city` for geographic data and `react-select` for searchable dropdowns. Country defaults to United States. State appears when country is selected; City appears when state is selected. Stores structured `country`, `state`, and `city` fields in Firestore.

Admin dashboard handles both old freetext records (shows `"New York City"`) and new structured records (shows `"Brooklyn, NY"`). Location filter now searches across city, state, and country fields.

**Files:**

- `package.json` — added `react-select`, `country-state-city`, `@types/react-select`
- `src/types/application.ts` — added optional `country?`, `state?` fields
- `src/utils/locationDisplay.ts` — new file with `formatLocation()` and `searchableLocation()` helpers
- `src/pages/ApplyPage.tsx` — replaced city input with 3 cascading `<Select>`, updated FormState/validation/submission
- `src/components/admin/ApplicantCard.tsx` — uses `formatLocation(app)` instead of `app.city`
- `src/components/admin/ApplicantModal.tsx` — uses `formatLocation(app)`, label changed to "Location"
- `src/components/admin/AdminDashboard.tsx` — uses `searchableLocation(app)` in filter, placeholder changed to "Location…"

**Decisions:**

- `country` and `state` are optional on the `Application` type so old Firestore docs without them still satisfy the type — no data migration needed
- `formatLocation` falls back to `app.city` when `app.state` is missing (legacy compat)
- react-select styles custom-matched to existing ivory/gold design system

## feat: add podcast links to LinksPage

- Added "Gen Zenophobic Podcast" (Wyatt's podcast) and "Big Silly World Podcast" links
- Both link to their YouTube episodes where Garam Masala Dating was promoted
- Placed after YouTube and before "Upcoming Shows & Tickets" with Mic icon
- Imported `Mic` from lucide-react

**Files:** `src/pages/LinksPage.tsx`

## feat: soft-delete & visual hierarchy for admin applications

- Added `deletedAt` field to `Application` type — soft-delete without losing original status
- **ApplicantCard**: trash icon overlay on hover (delete), archive-restore icon (restore), `dimmed` prop for rejected/deleted cards (opacity + desaturation)
- **ApplicantModal**: "DELETED" banner on photo, "Move to Deleted" / "Restore" footer buttons
- **AdminDashboard**: active/deleted partition with rejected apps dimmed & sorted to bottom; collapsible "Deleted Applications" section; header shows active count
- No Firestore migration needed — existing docs without `deletedAt` default to active

**Files:** `src/types/application.ts`, `src/components/admin/ApplicantCard.tsx`, `src/components/admin/ApplicantModal.tsx`, `src/components/admin/AdminDashboard.tsx`

## feat: add email icon to bottom socials row

- Added Mail icon to the SOCIALS array on the Links page
- Links to `mailto:contact@garammasaladating.com`
- Bottom social row now shows: Instagram, TikTok, YouTube, Email

**Files:** `src/pages/LinksPage.tsx`

## update: press email, landing page tagline, and creator hyperlinks

- Changed press/collaborations mailto from `press@` to `contact@garammasaladating.com`
- Rewrote landing page tagline with new copy including creator names and venue
- Added hyperlinks: Surbhi → Instagram, Wyatt Feegrado → Instagram, Top Secret Comedy Club → website
- Links styled in gold (`#E2C97E`) with hover transition

**Files:** `src/pages/LinksPage.tsx`, `src/components/CenterBox/CenterBox.tsx`, `src/components/CenterBox/CenterBox.module.css`

## fix: replace Music2 with TikTok logo and add YouTube to bottom socials

- Created inline `TikTokIcon` SVG component since Lucide doesn't have a TikTok brand icon
- Replaced `Music2` (music note) with the actual TikTok logo in both the LINKS and SOCIALS arrays
- Added YouTube to the bottom social icon row with the existing `Youtube` Lucide icon
- Removed unused `Music2` import

**Files:** `src/pages/LinksPage.tsx`
