# Lessons

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

**Rule:** When opening any modal, call `dialog.focus()` (where the dialog has `tabindex="-1"`) — never `.modal-close.focus()`. Focusing a `tabindex="-1"` element is always treated as non-keyboard, so `:focus-visible` never triggers. Keyboard users who Tab into the modal still get the correct ring. Add `outline: none` to the dialog element as a guard.

## Review the active PR stack before broad production rewrites

**What went wrong:** I initially framed the analytics/performance cleanup too narrowly, even though several open PRs were already part of a broad rewrite stack.

**Why:** On a stacked rewrite, narrow local patches can duplicate prior work or miss the durable shared layer the user actually needs.

**Rule:** For broad analytics, conversion, SEO, or performance work, inspect the active/open PR stack first, then make sustainable shared-system improvements that build on it. Do not default to the smallest patch when the user explicitly asks for the durable rewrite path.
