# Broken Links Audit — 2026-03-31

## Internal Links

All internal `<Link to>` and `<a href>` targets were crawled against the route table in `App.tsx`. **No broken internal links found.**

### Verified Internal Routes

| Source | Target | Status |
|--------|--------|--------|
| Nav.tsx | `/apply` | OK |
| CenterBox.tsx | `/` (home) | OK |
| LinksPage.tsx | `/apply` | OK |
| CityPage.tsx | `/cities`, `/links`, `/apply` | OK |
| JournalPostPage.tsx | `/journal`, `/apply` | OK |
| TipPostPage.tsx | `/south-asian-dating-tips`, `/apply` | OK |
| NotFound (App.tsx) | `/` | OK |

### Intentional `href="#"` (Not Broken)

- `LinksPage.tsx` — "As Seen In" item: `href="#"` is overridden by an `onClick` handler that opens a press modal.
- `LinksPage.tsx` — "Upcoming Shows & Tickets" item: `href="#"` is overridden by an `onClick` handler that opens an events modal.
- `events.ts` — Edinburgh and India Tour entries have `url: "#"` but are rendered as non-clickable `<div>` elements (conditional rendering prevents `<a>` tag).

## External Links (Manual Verification Needed)

These link to third-party sites and cannot be verified via code alone:

| Source | URL | Notes |
|--------|-----|-------|
| socials.ts | instagram.com/garammasaladating | Social profile |
| socials.ts | tiktok.com/@garammasaladating | Social profile |
| socials.ts | youtube.com/@GaramMasalaDating | Social profile |
| socials.ts | instagram.com/lordmakemetaller/ | Creator (Surbhi) |
| socials.ts | instagram.com/wyattfeegrado/ | Creator (Wyatt) |
| socials.ts | topsecretcomedyclub.com/ | Venue |
| events.ts | 6x Eventbrite ticket URLs | Past events may 404 |
