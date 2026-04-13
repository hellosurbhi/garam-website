# Lessons

## Never focus the close button when opening a modal

**What went wrong:** `NotifyModal.astro` and `LegalModal.astro` called `.focus()` on the close button immediately after `showModal()`. This triggered `:focus-visible` and showed the brand-red focus ring on the X button every time a modal opened.

**Why:** `element.focus()` in JS is treated as a potential keyboard-initiated focus by browsers (they can't always distinguish), so `:focus-visible` fires. `showModal()`'s own auto-focus has slightly different (browser-specific) heuristics.

**Rule:** When opening any modal, call `dialog.focus()` (where the dialog has `tabindex="-1"`) — never `.modal-close.focus()`. Focusing a `tabindex="-1"` element is always treated as non-keyboard, so `:focus-visible` never triggers. Keyboard users who Tab into the modal still get the correct ring. Add `outline: none` to the dialog element as a guard.
