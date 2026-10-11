# Form repair rollout

This branch repairs application rules, submission confirmation, signup failures and waiver receipt timing. Local tests do not change the live Firebase rules or Vercel deployment.

## Before release

Run `npm run lint`, `npm run check`, `npm test` and `npm run test:rules`. Build with `npx astro build` and run `npx playwright test tests/smoke/critical-flows.spec.ts`. The smoke fixtures intercept Firebase and first-party API writes; they verify browser behavior without creating real leads or sending producer alerts. Emulator tests verify actual rule enforcement.

## Release order

1. Review and merge the PR through the normal owner workflow. No agent production deployment is part of this repair.
2. Deploy the reviewed `firestore.rules` to the established production Firebase project through the normal rules release procedure. The application validation retains its existing field and photo constraints while reducing evaluation cost. A website deployment alone does not deploy these rules.
3. Confirm the Vercel production deployment contains the same reviewed commit. Background receipt work uses the existing `@vercel/functions` dependency and requires no new service or configuration.
4. Run the existing `synthetic-apply.yml` workflow on the released commit. Its rules-drift check must pass. The monitor now submits ten photos; `scripts/synthetic-apply-verify.mjs` requires a fresh complete ten-photo document and still cleans verified synthetic records on failure.
5. Review the workflow result and production failure alerts. Confirm a real saved application appears in the admin dashboard and that receipt email delivery is separately observable. Do not claim the live repair is verified based only on mocked browser tests.

## Expected outcomes

A pending application write keeps its uploaded photos and blocks another submission in the same page. A late success opens the confirmation panel. A definitive rejection permits a retry and performs existing cleanup. Missing-photo alerts say the application was saved only after the write succeeds. Analytics errors do not prevent lead capture. Signup network requests stop waiting after 20 seconds; malformed success bodies are treated as unconfirmed. Waiver confirmation acknowledges persistence, while email delivery continues in background work. The failure-alert API returns 503 if neither configured channel accepts delivery and releases its deduplication claim.

Cross-reload idempotency, atomic multi-document waiver recovery and bounded failure cleanup remain documented overnight work in `BUGS.md`.
