# Show history log

Permanent record of every show change: cancellations, date moves, time moves, roster changes and removals. Newest first. Shows are NEVER deleted from `src/data/events.ts`; a canceled show keeps its entry with `status: "canceled"`. This file exists because deletions used to erase history that the owner wants kept.

## Log

- 2026-08-26: Aug 30 Washington DC show start time moved from 8 PM to 6 PM (end time moved from 10 PM to 8 PM accordingly), date unchanged, still DC Comedy Loft.
- 2026-08-26: Manhattan regular show venue changed from Top Secret Comedy Club to City Winery NYC (The Loft at City Winery NYC, 25 11th Ave), future/general copy only (homepage, tickets page, Manhattan city page, journal articles, llms-full feed). Past show entries and the VENUE_TOP_SECRET constant are untouched; the Oct 11 All Stars show already used City Winery NYC before this change.
- 2026-08-14: Notify-me roster changed to the standing three: Los Angeles, San Francisco and New York (Manhattan). Chicago and Houston removed from the roster. Edison's TBA card taken off the site (`hidden: true`, entry kept).
- 2026-08-14: Aug 16 Manhattan "Cuffing Season" at Top Secret canceled. Entry restored with `status: "canceled"` after briefly being deleted the same day (commit 9ff0b67, reverted by this change).
- 2026-08-03: Boston show moved from Aug 2 to Aug 13, start moved from 6 PM to 7 PM, still Elephant & Castle (commit f4b006f).
- 2026-07-10: Philadelphia rescheduled from TBA to Aug 28 at Next In Line Comedy, start moved from 7:30 PM to 7 PM (commit c632e66).
- 2026-07-07: Jul 11 Edison date canceled, entry moved to TBA (commit 1b80acf, which deleted the date outright; date recorded here).
- 2026-07-07: Jul 12 Philadelphia date canceled, entry moved to TBA (commit 1b80acf, same deletion pattern; date recorded here).
- 2026-06-17: NYC "Cuffing Season" moved from Aug 2 to Aug 16 (commit cc577f5).
- 2026-05-20: Notify-me roster changed from Los Angeles, San Diego to Los Angeles, Chicago, Houston (commit efe3f5c).
- 2026-04-29: NYC Pride moved from Jun 14 to Jun 21 (commit 165df6b).
- 2026-04-29: Notify-me roster: San Francisco dropped after its May 10 show was confirmed (commit 165df6b).
- 2026-04-21: Jersey City moved from Apr 26 to May 3 (commit e14b755).
- 2026-04-08: Edinburgh TBA and India Tour Dec 2026 removed from the site data; the site never had a live ticket link for either (commit e0af623).
- 2026-04-04: Apr 19 NYC and Apr 26 Jersey City start times set to 6 PM (commit 8c25bee).
- 2026-03-27: Apr 4 Chicago hidden from the site without deleting the entry, reason unrecorded (commit f5124be).
- 2026-02-17: Early season lineup replaced (commit 4e3817a). Feb 28 NYC moved to Feb 22. Mar 14 NYC St Patrick's moved to Mar 15. Apr 11 NYC, May 9 Los Angeles, Jun 6 London and Jul 4 NYC removed from the site data; the site never had a live ticket link for any of them.

## How to change a show (for future sessions)

- Cancel: set `status: "canceled"` on the entry, add a `note`, add a line here. Never delete the entry.
- Move a date: update `isoDate` and `date`, set `previousDate` to the old date, add a `note`, add a line here.
- Time or venue change: update the fields, add a line here.
- Notify-me roster change: edit `TBA_CITIES`, add a line here.
- Venue constants are permanent too: never delete one, even if no event references it anymore.
- Deleting an event entry is never correct, no matter how the request is phrased.
