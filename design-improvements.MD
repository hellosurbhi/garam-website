# Design Engineering Review: Garam Masala Dating

> Full-site design audit. Brutally honest. Extremely opinionated. In the style of Emil Kowalski's design engineering standards.

---

## The Verdict: 7/10 — "Good bones, but not premium yet"

This site is **better than 90% of event websites**. The hero is genuinely excellent. The typography choices (Playfair + Nunito + Cormorant) are sophisticated. The WebGL shader is a flex. The CTAs are clear. The SEO is elite-tier.

But it doesn't feel like a **$25K/month entertainment brand**. It feels like a very well-executed indie project. The gap between "good" and "world-class" is in the details: transitions that end abruptly, sections that sit flat on the page, interactions that feel functional but not alive, and a rhythm that loses energy after the hero.

Here's exactly what's holding it back and how to fix it.

---

## 1. VISUAL DESIGN

### What's Working

- **Hero typography** is genuinely excellent. The Playfair Display at `clamp(70px, 11vw, 116px)` with `line-height: 0.9` and the red italic "ala" accent — this is high-taste work. The staggered `pop` + `rise` animations with cubic-bezier easing make the entrance feel crafted.
- **Color palette** is cohesive. Brand red (#dc2626) + electric yellow (#ffd600) + warm neutrals — this reads as "spicy, warm, energetic" which is perfect for the brand.
- **Font trio** is smart. Playfair for authority, Cormorant for elegance/warmth, Nunito for readability. Three fonts that actually earn their place.

### What's Not Working

**The site has an energy cliff after the hero.** The hero is a 9/10. Then the marquee is fine. Then everything below feels like it was built by a different, less ambitious team.

**Specific issues:**

1. **Section backgrounds are flat and predictable.** The pattern is: white → red marquee → off-white experience → charcoal shows → photo over stats → warm cream press → photo over testimonials → off-white creators → white video → cream FAQ. This alternation is _correct_ but _boring_. Every section is a rectangle with padding. No diagonal cuts, no overlapping elements, no sections bleeding into each other. It reads like a content document, not a living brand.

2. **The charcoal (#1a1a1a) sections (Shows, Photos) feel heavy and disconnected.** Two back-to-back dark sections (Shows → Stats) create a dark tunnel in the middle of the page. The transition from bright Experience section to dark Shows is jarring with zero visual bridge.

3. **Stats section is underwhelming.** The numbers ("40+", "2K+", "100%", "13", "10M+") are just sitting there as static yellow text on a photo. No animation, no count-up, no visual drama. For a section called "The Numbers Don't Lie," the numbers are remarkably lifeless.

4. **Press section is thin and feels like filler.** Three press names in italic Playfair with two marked "Coming Soon" at 40% opacity. This actively hurts credibility instead of building it. Either have real press or cut this section until you do.

5. **Inconsistent spacing scale.** Section padding ranges from 30px to 120px with no mathematical relationship. The Creators section has `padding: 30px 20px` (cramped) while Testimonials has `padding: 80px 20px` (generous). This creates an uneven visual rhythm — some sections feel rushed, others breathe.

6. **Too many hardcoded grays.** `#666`, `#888`, `#999`, `rgba(26,26,26,0.87)`, `rgba(255,255,255,0.7)`, `rgba(255,255,255,0.55)` — the neutral palette is chaotic. A top-tier designer would have 3-4 named opacity levels, not 12 arbitrary values.

7. **The `--cream` token is a duplicate of `--off-white`.** Both resolve to `#fff8f0`. Pick one, delete the other. Similarly `--text` duplicates `--charcoal`. And `--hover-subtle` is declared but never used. The token system needs a cleanup pass.

---

## 2. UX / PRODUCT THINKING

### What's Working

- **CTA hierarchy is clear.** "Get Tickets" (red, primary) vs "Fall In Love / Apply" (outline, secondary) — consistent across every section.
- **Next-show pill in hero** is clever UX — dynamically shows the next upcoming event with a direct link. Smart.
- **FAQ with single-open behavior** is well-executed. The Cormorant serif questions at 25px feel elegant.
- **Email popup at 30s** is aggressive but justified for a show that sells out.

### What's Not Working

1. **The page is too long for what it communicates.** 10 sections on the homepage. The user needs to know 3 things: what this is, when's the next show, how to buy tickets. By section 5 (Stats), most mobile users have bounced. Consider cutting Photos, Stats, Press, and Creators from the homepage — move them to dedicated pages.

2. **"100% One Night Stand Rate" stat is confusing and potentially off-putting.** Is this a joke? A real metric? What does it measure? A first-time visitor might read this as sexual, not comedic. This needs a tooltip, rewording, or removal. Consider: "100% Chemistry Score" or just cut it.

3. **No social proof above the fold.** The testimonials are buried at section 7. A single pull-quote under the hero subtitle would massively increase conversion. Something like: _"Best live comedy show in NYC right now." — Dev, 31_

4. **Video section is placed too late (section 9 of 10).** Video is the single most powerful conversion tool for a live show. It should be in the top 3 sections, not buried below creators and press.

5. **Apply form has no expectation-setting.** A user clicks "Apply" and lands on a 15-field form with zero context about: what happens after applying, acceptance rate, what the on-stage experience is like, or timeline. This is a high-friction conversion without sufficient motivation. Add a top panel: "We receive hundreds of applications. Here's what to expect..."

6. **The "Request Your City" flow is nice but feels like a dead end.** User submits → "Request received! We'll keep you posted." No indication of how many people have already requested, no social proof, no "Share to boost your city's chances."

7. **Shows section "Get Tickets" label is an 11px uppercase text label, not a button.** This is the primary conversion element on the site, and it reads as metadata, not an action. Users may not realize it's clickable.

---

## 3. INTERACTION & ANIMATION — THE BIGGEST GAP

This is where the site drops from "good" to "average." The hero animations are excellent. Everything else is either static, abrupt, or missing.

### What Exists (and works)

- **Hero entrance sequence:** `pop` (0.6s, bouncy cubic-bezier) → `rise` (0.9s, staggered 0.2-0.5s) — genuinely delightful
- **Button hover:** `translateY(-3px)` with `cubic-bezier(0.34, 1.3, 0.64, 1)` — feels springy and alive
- **Scroll reveal:** `data-reveal` with IntersectionObserver → `opacity: 0; translateY(32px)` → `opacity: 1; translateY(0)` at 0.7s — solid foundation
- **Marquee:** 22s linear infinite — works, never distracting
- **Photo hover:** `scale(1.025) + brightness(1.08)` at 0.35s — subtle and nice

### What's Missing or Broken

#### A. No exit animations anywhere

- Modals pop in with `scale(0.95) → scale(1)` at 0.25s. They **vanish instantly** on close. This is the #1 amateur tell in UI. Every dialog should fade/scale out in ~200ms.
- FAQ accordion: opens instantly (no height transition), closes instantly. The `+` rotates to `×` (good), but the content just appears/disappears.
- Toast notifications: no enter or exit animation.
- Popup steps (email → phone): step 1 `hidden`, step 2 `removeAttribute("hidden")` — the content swap is instant. Should crossfade.

#### B. Show cards have almost no hover state

The show cards in HomeShows just do `opacity: 0.8` on hover. For the PRIMARY CONVERSION ELEMENT of the entire site (buying tickets), this is catastrophically underwhelming. These cards should feel alive:

- Slight lift (`translateY(-2px)`)
- Border glow or color shift
- The "Get Tickets" label should animate (arrow slide, color pop)
- A subtle background tint on the card

#### C. No stagger on list/grid reveals

Photos, show cards, stats, creator cards — they all use `data-reveal` but reveal simultaneously. When 8 photos appear at the exact same moment, it feels like a page load, not an experience. Stagger by 50-80ms per item.

#### D. Stat numbers don't animate

"40+", "2K+", "10M+" — these should count up when they scroll into view. This is table-stakes for a stats section. Use `IntersectionObserver` + `requestAnimationFrame` to increment from 0 to final value over ~1.5s with easeOut.

#### E. The WebGL shader is invisible to the point of irrelevance

`opacity: 0.5` on the canvas, sitting behind a `radial-gradient` on white. For a $2,000 asset, it should be more prominent. Consider: higher opacity (0.7), reduce the white overlay gradient, or add a subtle parallax effect on scroll.

#### F. No micro-interactions on form fields

The apply form inputs transition `border-color` and `box-shadow` on focus — fine. But there's no label float animation, no success state (green check), no field-entered state. Compare to Stripe's checkout form or Linear's signup — every field interaction communicates state.

### Specific Animation Fixes

| Element               | Current                 | Should Be                                                       |
| --------------------- | ----------------------- | --------------------------------------------------------------- |
| Modal close           | Instant disappear       | `opacity 1→0, scale 1→0.95` in 200ms ease-in                    |
| FAQ accordion         | Instant expand/collapse | `grid-template-rows: 0fr→1fr` transition, 300ms ease-out        |
| Show card hover       | `opacity: 0.8`          | `translateY(-2px), border glow, bg tint` 200ms                  |
| Photo grid entrance   | All at once             | Stagger 60ms per item with `data-reveal`                        |
| Stat numbers          | Static text             | Count-up animation on scroll-into-view, 1.5s easeOut            |
| Popup step transition | Instant swap            | Crossfade 250ms between step-1 and step-2                       |
| Toast notification    | No animation            | Slide up 8px + fade in, 250ms; slide down + fade out on dismiss |
| "Get Tickets" label   | Static text             | Arrow slides right 4px on card hover, 200ms                     |
| Creator card hover    | Border color change     | Border + subtle scale(1.02) + shadow lift                       |
| Scroll cue arrow      | Bounce animation        | Good as-is, but hide after first scroll event                   |

---

## 4. COMPONENT DESIGN

### Strengths

- **Modal base component** uses native `<dialog>` with proper aria — excellent
- **Button system** (`.btn-hot`, `.btn-outline`) is consistent with springy easing
- **Form fields** in ApplyPage have proper error states, aria-invalid, touch targets
- **PhotoUploadField** is clean and reusable

### Problems

1. **No shared button component.** `.btn-hot` is defined in HomeHero's scoped `<style>`. Then it's re-defined (differently) in HomeFAQ's `.faq-cta-btn`, HomeExperience's `.exp-cta-btn`, HomeShows's `.modal-submit`. Same visual pattern, 4 different implementations with slightly different padding, font-sizes, and transitions. This should be ONE shared class in `index.css`.

2. **Modal styles are duplicated 3+ times.** `HomeShows` has `.modal-dialog` + `.modal-inner` + `.modal-close` + `@keyframes modalIn`. The email popup in `index.astro` has `.popup-dialog` + `.popup-inner` + `.popup-close` + `@keyframes popupIn`. These are near-identical. Should share a base.

3. **ApplyPage.tsx is 643 lines.** This is a monolith. The form sections (personal info, location, photo, pitch, legal) should each be extracted into sub-components. The orchestration logic is already in `useApplyForm` (good), but the JSX render is too dense.

4. **AdminDashboard.tsx is 401 lines** with heavy inline styles (`style={{ marginBottom: "12px" }}`). Inconsistent with the CSS-module pattern used elsewhere. Migrate to CSS modules.

5. **Eyebrow pattern is repeated but not abstracted.** HomeHero, HomeFAQ, HomeVideo, HomePress all have a small uppercase label above the heading. Each defines it independently with slightly different sizes (10-12px), letter-spacing (1.5-3px), and colors. Should be one `.eyebrow` class.

6. **CTA pair pattern is repeated.** "Primary button + italic Cormorant link" appears in Experience, FAQ, and other sections. Same layout, different class names. Extract as `.cta-pair`.

7. **ContestantPrepPage uses React for a near-static page.** The gender toggle + session auth could be vanilla JS, saving ~40KB of React bundle on that page.

---

## 5. "TASTE" AUDIT — The Hard-to-Explain Stuff

This is what separates a $5K website from a $50K website.

### What Feels "Off"

1. **The site lacks spatial depth.** Everything is flat rectangles stacked vertically. No overlapping elements, no z-index play, no elements that break the grid. Compare to: Vercel's homepage (overlapping cards), Linear's landing (gradient meshes bleeding between sections), Apple Events (immersive photo breaks). The hero has depth (shader + gradient + content), but everything below is a flat stack.

2. **Photo backgrounds feel like a crutch.** Stats and Testimonials both use full-bleed photos as section backgrounds with text overlaid. This pattern, used twice in close proximity, feels repetitive. One immersive photo section is dramatic. Two is a template pattern.

3. **The marquee feels like a 2019 design trend that's now dated.** Infinite-scroll marquees had their moment. On a premium site in 2026, this reads as "I saw this on a Framer template." If you keep it, make it more interesting: variable speed on hover, or text that responds to cursor position. Or replace it with something more distinctive.

4. **Section headings are too uniform.** Every section uses the same pattern: big Playfair serif + small Cormorant italic subtitle. After 10 sections, this becomes monotonous. Vary the heading treatments: some sections could lead with the subtitle, some could use a different weight, some could break the line differently.

5. **The footer is utilitarian, not branded.** Dark background, 4 columns of links, logo, social icons. This is _correct_ but could be the footer of any website. For a show about love and chaos, the footer should have personality: a closing line, a candid photo, something that makes you smile.

6. **No personality in the transitions.** The scroll reveals are all identical: `translateY(32px) → 0, opacity 0 → 1`. Every single element on the page enters the same way. This is the definition of a template feel. Vary it: some elements could slide from the left, some could scale up, the photo grid could stagger. Give each section its own entrance personality.

7. **The overall color temperature runs warm but never hot.** Brand red is #dc2626 (warm), yellow is #ffd600 (warm), cream is #fff0e2 (warm). But nothing POPS. There's no moment of visual intensity below the hero. A dating show about "chaos" should have at least one section that visually shouts.

8. **The Cormorant italic is over-used as decoration.** It appears as subtitle, quote, pill CTA, FAQ question, link text. When one font-style is everywhere, it stops feeling special. Reserve Cormorant italic for 2-3 high-impact moments.

---

## 6. SPECIFIC IMPROVEMENTS

### Quick Wins (1-2 hours each)

1. **Add modal exit animations.** In every `dialog.close()` handler, add a `closing` class that plays `scale(1) → scale(0.97), opacity 1 → 0` over 200ms, then remove the dialog after animation ends. ~30 lines of shared JS.

   ```js
   function closeWithAnimation(dialog) {
     dialog.classList.add("closing");
     setTimeout(() => {
       dialog.classList.remove("closing");
       dialog.close();
     }, 200);
   }
   ```

   ```css
   dialog.closing .modal-inner {
     animation: modalOut 0.2s ease-in forwards;
   }
   @keyframes modalOut {
     to {
       opacity: 0;
       transform: scale(0.97);
     }
   }
   ```

2. **Stagger `data-reveal` elements within grids.** In the IntersectionObserver callback in `index.astro`, check if multiple siblings have `data-reveal` and add `transition-delay: ${index * 60}ms`. This makes grids cascade instead of appearing at once.

3. **Fix show card hover states.** Replace `opacity: 0.8` with:

   ```css
   .show-card {
     transition:
       background 0.25s,
       transform 0.25s;
   }
   .show-card:hover {
     background: rgba(255, 255, 255, 0.04);
     transform: translateX(4px);
   }
   .show-card:hover .ticket-label {
     color: white;
     letter-spacing: 2.5px;
   }
   ```

4. **Consolidate button styles into `index.css`.** Move `.btn`, `.btn-hot`, `.btn-outline` from HomeHero's scoped style to global. Remove the 4 duplicate button definitions across components. ~15 min.

5. **Add a testimonial pull-quote to the hero area.** After `hero-sub`, add a small rotating quote: `"Best live show in NYC" — Dev, 31` in 14px Cormorant italic. Rotate between 3 quotes with a 5s interval and crossfade.

6. **Animate stat numbers on scroll.** Add a `countUp(el, target, duration)` utility. Trigger via IntersectionObserver when `.stats` enters viewport. Parse "40+" as countUp to 40 + append "+". ~40 lines of JS.

7. **Remove the `--cream` token** (it duplicates `--off-white`). Remove `--text` (duplicates `--charcoal`). Remove `--hover-subtle` (unused). Clean up `index.css`.

8. **Fix the `#fff0e2` hardcoded color in HomeFAQ.** Replace with `var(--cream-warm)` which resolves to the same value.

### Medium Effort (half-day each)

9. **Rethink the page section order.** Move Video UP to position 3 (after Marquee). Move Shows to position 2 (immediately after Marquee — the user came to buy tickets, show them shows ASAP). Cut Press section until there are 5+ real mentions. Suggested order:
   - Hero → Marquee → Shows → Video → Experience → Testimonials → FAQ → Creators → Footer

10. **Add FAQ height animation.** Replace the instant `<details>` expand with a CSS `grid-template-rows: 0fr → 1fr` transition (the modern approach). This gives smooth accordion expand/collapse without JS height calculation.

    ```css
    .faq-answer {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.3s ease-out;
    }
    .faq-answer > div {
      overflow: hidden;
    }
    .faq-item[open] .faq-answer {
      grid-template-rows: 1fr;
    }
    ```

11. **Differentiate scroll-reveal animations by section type.** Instead of one global `translateY(32px)` reveal:
    - Text blocks: `translateY(24px)` fade (current, fine)
    - Cards/grid items: `translateY(16px) + scale(0.97)` with stagger
    - Full-width sections (Stats, Testimonials): `opacity` only, no translate (they're already in the viewport flow)
    - CTAs: `translateY(12px)` with slight delay after their parent heading

12. **Create a "Visual Bridge" between light and dark sections.** Before the Shows section (charcoal), add a gradient transition element: a 60px div that goes from the Experience section's background to charcoal. Or use a diagonal `clip-path: polygon(0 0, 100% 3%, 100% 100%, 0 100%)`. This prevents the jarring light→dark cut.

13. **Add shared component classes.** Create `.eyebrow`, `.cta-pair`, `.section-heading` utility classes in `index.css`. Refactor existing duplicated patterns to use them.

### Deeper Refactors (1-2 days each)

14. **Rebuild the spacing system.** Define a scale in CSS custom properties:

    ```css
    :root {
      --space-section-sm: 48px; /* Compact sections (Press, Marquee) */
      --space-section-md: 80px; /* Standard sections */
      --space-section-lg: 120px; /* Hero-level breathing room */
      --space-section-mobile-sm: 40px;
      --space-section-mobile-md: 60px;
      --space-section-mobile-lg: 80px;
    }
    ```

    Replace all section padding with these values. This creates consistent visual rhythm.

15. **Add parallax depth to photo-background sections.** Stats and Testimonials both use background photos. Add a subtle `transform: translateY(calc(var(--scroll-y) * -0.1))` parallax to the `.stats-bg` and `.testi-bg` images. This adds depth without being distracting. Use `requestAnimationFrame` + scroll listener, throttled.

16. **Redesign the Shows section for higher conversion.** Current: horizontal row with date | city | "Get Tickets" label. Redesign as:
    - Larger cards with the date prominently styled
    - An actual button per card (not just a label)
    - "Selling fast" or "X seats left" urgency indicator where applicable
    - On mobile: swipeable horizontal scroll of cards
    - Tap area covers the whole card (currently it does, but visual treatment doesn't communicate this)

17. **Split ApplyPage.tsx into sub-components.** Extract: `<PersonalInfoSection>`, `<LocationSection>`, `<PhotoSection>`, `<LegalSection>`. Each 80-120 lines. The main `ApplyPage` becomes an orchestrator ~150 lines.

18. **Remove React from ContestantPrepPage.** Convert to Astro + vanilla JS. Saves ~40KB bundle on that page.

---

## 7. PRIORITIZED ACTION PLAN

### Top 10 Highest-Impact Fixes

| #   | Fix                                                                       | Impact             | Effort | Why                                                                                                                                                            |
| --- | ------------------------------------------------------------------------- | ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Reorder homepage sections** (Shows up to #2, Video up to #3, cut Press) | Conversion +++     | Medium | Users came to buy tickets. Show them shows within one scroll. Video is the #1 converter for live events. Press with "Coming Soon" items hurts more than helps. |
| 2   | **Add exit animations to all modals/dialogs**                             | Polish +++         | Quick  | Instant-close is the single biggest amateur tell on the site. 30 lines of shared JS fixes every dialog.                                                        |
| 3   | **Redesign show card hover/interaction**                                  | Conversion ++      | Quick  | The ticket-buying cards have the weakest hover state on the entire site. This is your money element.                                                           |
| 4   | **Stagger grid/list reveal animations**                                   | Polish ++          | Quick  | Photos, cards, stats appearing all at once = template feel. 60ms stagger = crafted feel.                                                                       |
| 5   | **Animate stat counter numbers**                                          | Engagement ++      | Quick  | Static numbers are dead. Counting numbers are alive. This is table-stakes for a stats section.                                                                 |
| 6   | **Add FAQ smooth height animation**                                       | Polish ++          | Medium | The accordion snap-open is jarring. `grid-template-rows: 0fr→1fr` transition is the modern fix.                                                                |
| 7   | **Consolidate button/modal/eyebrow into shared styles**                   | Maintainability ++ | Medium | 4 different button implementations, 3 different modal implementations. DRY these up.                                                                           |
| 8   | **Add social proof to hero area**                                         | Conversion ++      | Quick  | A pull-quote below the subtitle massively increases trust at the highest-traffic point on the page.                                                            |
| 9   | **Add visual bridges between dark/light sections**                        | Polish +           | Medium | The jarring light→dark→dark→light transitions break the visual flow. Gradient transitions or diagonal clips fix this.                                          |
| 10  | **Differentiate section entrance animations**                             | Polish +           | Medium | Every element entering with identical `translateY(32px)` is monotonous. Give sections personality.                                                             |

### Quick Wins (ship today)

- [ ] Fix #2: Modal exit animations
- [ ] Fix #3: Show card hover states
- [ ] Fix #4: Stagger reveals within grids
- [ ] Fix #5: Stat counter animation
- [ ] Fix #8: Hero pull-quote
- [ ] Remove `--cream`, `--text`, `--hover-subtle` orphan tokens
- [ ] Replace `#fff0e2` hardcode with `var(--cream-warm)` in HomeFAQ

### Deeper Work (this week)

- [ ] Fix #1: Section reorder
- [ ] Fix #6: FAQ height animation
- [ ] Fix #7: Shared component styles (buttons, modals, eyebrow)
- [ ] Fix #9: Section transition bridges
- [ ] Fix #10: Varied entrance animations
- [ ] Rebuild spacing scale in `index.css`

### Next Sprint (future)

- [ ] Parallax on photo-background sections
- [ ] Redesign Shows cards for higher conversion
- [ ] Split ApplyPage.tsx into sub-components
- [ ] Remove React from ContestantPrepPage
- [ ] Add expectation-setting panel to Apply page

---

## 8. INSPIRATION REFERENCES

Look at these products for specific patterns:

- **Linear (linear.app)** — Gradient meshes, subtle motion, section transitions, premium feel on a SaaS
- **Vercel (vercel.com)** — Overlapping cards, depth layering, varied section treatments
- **Stripe (stripe.com/sessions)** — Modal enter/exit animations, form field polish, count-up stats
- **Arc Browser (arc.net)** — Playful micro-interactions, cursor responses, hover delights
- **Apple Events pages** — Immersive photo breaks, typography variation, section rhythm
- **Rauno Freiberg's site (rauno.me)** — This is the exemplar for "high-taste design engineering." Study his scroll reveals, button feedback, and attention to detail.
- **Emil Kowalski's site (emilkowal.ski)** — Exit animations, modal choreography, genuinely crafted interactions.

---

## Files to Modify

**Core animation/interaction:**

- `src/pages/index.astro` — reveal stagger logic, section order, popup exit animation, shared reveal utilities
- `src/components/home/HomeShows.astro` — card hover states, modal exit animation
- `src/components/home/HomeStats.astro` — counter animation
- `src/components/home/HomeFAQ.astro` — smooth accordion (`grid-template-rows`), fix hardcoded `#fff0e2`
- `src/components/home/HomeHero.astro` — social proof addition (pull-quote under subtitle)

**Shared styles:**

- `src/index.css` — shared `.btn`, `.eyebrow`, `.cta-pair`, modal-base tokens, spacing scale, token cleanup

**Component consolidation:**

- `src/components/home/HomeExperience.astro` — use shared button class, fix hardcoded `#666`
- `src/components/home/HomeFAQ.astro` — use shared button class
- `src/components/home/HomePress.astro` — potentially remove from homepage
- `src/components/home/HomeCreators.astro` — use shared styles, adjust padding
- `src/components/ApplyPage.tsx` — split into sub-components (deeper refactor)
- `src/components/ContestantPrepPage.tsx` — convert to Astro (deeper refactor)
- `src/components/admin/*` — migrate inline styles to CSS modules

---

## Verification Checklist

After implementing fixes:

- [ ] `npm run build` — no build errors
- [ ] `npx astro check` — no type errors
- [ ] `npm run lint` — no lint errors
- [ ] `npm test` — all tests pass
- [ ] Visually test on mobile (375px) and desktop (1440px)
- [ ] Check `prefers-reduced-motion` — all new animations respect it
- [ ] Lighthouse performance score stays 90+
- [ ] All modals open AND close with animations
- [ ] FAQ accordion animates smoothly (both directions)
- [ ] Stat counters trigger on scroll into view
- [ ] Staggered reveals look intentional, not buggy
- [ ] Show card hover feels obviously clickable
- [ ] Hero pull-quote rotates smoothly
- [ ] No regression in existing delights (hero animation sequence, button hovers, photo hovers)

---

## Final Note

The foundation here is strong. The brand identity is clear. The technical execution is solid. What's missing is the final 20% of polish — the exit animations, the varied motion, the unified component system, the moments of delight beyond the hero — that separates good websites from **memorable** ones.

The hero proves you can do world-class work. The rest of the site needs to live up to it.
