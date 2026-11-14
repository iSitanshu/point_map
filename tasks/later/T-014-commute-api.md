# T-014 — Commute time via Google Distance Matrix

**Status:** later · **Priority:** P2 · **Estimate:** M · **Governed by:** ADR-0001, ADR-0005

## Why

`commute.minutesToWork` is typed in by hand today, and the time lens (ADR-0005) depends on it. Automating it from the work pin would make the time-adjusted comparison trustworthy rather than estimated — in Mumbai the difference between 25 and 55 minutes is the single biggest quality-of-life variable, and hand-entered guesses are optimistic.

## Acceptance criteria

- [ ] When a Google key and a work pin both exist, offer `Fetch commute times` for all points
- [ ] Use Distance Matrix with `mode=transit`, `departure_time` = next weekday 09:30
- [ ] Store `minutesToWork`, `distanceKm`, `fetchedAt`; never overwrite a hand-entered value without asking
- [ ] One batched request for up to 25 destinations; show cost before running
- [ ] Degrades silently to the manual field with no key

## Files

`app/map/google.js` · `app/lib/geo.js` · `app/ui/money.js`

## Notes

Deliberately *later*: it needs a billed key, which ADR-0001 keeps off the critical path. Straight-line distance plus a manual minutes field already covers the decision; this only improves precision.

Distance Matrix is billed per element (origins × destinations). 40 points is 40 elements per run — cheap, but show the number so it is never a surprise.
