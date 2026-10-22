# Rules for src/data (content files)

## Never delete an event from events.ts

No matter how the request is phrased. "Remove", "cancel" or "take down" a show means: set `status: "canceled"` on the entry, add a `note`, and add a line to the repo-root `EVENTS-HISTORY.md`. Date change means: update `isoDate`/`date`, set `previousDate` to the old date, add a `note` and a log line. Venue constants are equally permanent: never delete a venue definition even if no event references it anymore. Owner instruction 2026-08-14 after entries were deleted twice; every show ever scheduled stays in the data forever, the `isDisplayable()` predicate keeps canceled ones off every surface.

## Ranked listicles are countdowns

Write body headings highest number first, number 1 last: the winner is the payoff at the end, never the opener. Always populate `rankedItems` (ascending positions, 1 = best; the mismatch with body order is by design) so the countdown test in `journal.test.ts` protects the article. `keyTakeaway` may name the winner because it renders at the end of the article.
