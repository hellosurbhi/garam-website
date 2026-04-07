# Enhancements

Future improvements that are logged but not currently prioritized.

---

## Prefetch/preload key pages + skeleton loaders to eliminate CLS

**Priority:** High  
**Logged:** 2026-04-07

### Problem

The Apply and Get Tickets pages take noticeable time to load on first navigation. There is no skeleton or placeholder UI, so the page jumps from blank → content (CLS). These are the two highest-traffic destinations from the homepage nav.

### What to do

**1. Prefetch Apply and Tickets on homepage load**

Add `<link rel="prefetch">` tags in `BaseLayout.astro` (or the homepage `index.astro`) so the browser fetches those pages in the background while the user is on the homepage:

```html
<link rel="prefetch" href="/apply" />
<link rel="prefetch" href="/tickets" />
```

For Astro pages, `prefetch` is enough — no JS chunk prefetching needed since both pages are SSG.

Alternatively, use Astro's built-in prefetch:
- Enable `prefetch: true` in `astro.config.mjs`
- Add `data-astro-prefetch` to the nav links in `HomeNav.astro` and `PageNav.astro`

**2. Skeleton loaders on Apply page**

The Apply page hydrates a React island (`ApplyPage.tsx`) — there's a gap between HTML arriving and the form being interactive. Add a CSS skeleton that matches the form layout:

- Show the skeleton in the static Astro shell (`apply.astro`) until React hydrates
- Use `client:visible` or `client:idle` directive instead of `client:load` to defer hydration if above-the-fold content doesn't need it immediately
- Skeleton should reserve the exact height of the form to prevent CLS

**3. Skeleton on Tickets page**

Similar to Apply — if any dynamic content loads after HTML, add a skeleton placeholder that reserves layout space.

### Files to touch

- `src/layouts/BaseLayout.astro` — add prefetch link tags
- `src/components/home/HomeNav.astro` and `src/components/layout/PageNav.astro` — add `data-astro-prefetch` to Apply and Tickets links
- `src/pages/apply.astro` — add skeleton shell / adjust client directive
- `src/pages/tickets.astro` — add skeleton shell if needed
- `astro.config.mjs` — enable prefetch integration

### Notes

- Do NOT add `rel="preload"` (that's for critical resources on the current page). Use `rel="prefetch"` (background, lower priority).
- Test that prefetch doesn't increase LCP on the homepage (it should be fine since prefetch is low-priority).
- The goal is zero visible layout shift when navigating to Apply or Tickets from any page.
