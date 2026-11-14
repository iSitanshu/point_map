# T-009 — Duplicate-pin merge prompt

**Status:** next · **Priority:** P1 · **Estimate:** S · **Governed by:** ADR-0006

## Why

Two brokers pitch the same PG with different rents — this happens constantly in Mumbai, where the same building is listed by three agents. Right now that creates two pins 20 m apart and the map quietly becomes untrustworthy. Once the user stops believing the map is one-pin-per-place, they stop using it to decide.

The valuable outcome is not deduplication for tidiness. It is **keeping both brokers' quotes against one place**, because the gap between them is negotiating leverage.

## Acceptance criteria

- [ ] On save of a new point, detect existing points within 80 m (`haversineKm` already in `lib/util.js`)
- [ ] If any match, show a non-blocking prompt: *"Looks like **Sai Krupa** (₹15,000, broker Rahul). Same place?"* with `Merge` / `Keep separate`
- [ ] `Merge` keeps the existing point and appends a **quote** record: `{source, person, phone, rent, deposit, brokerage, date}`
- [ ] The detail drawer shows multiple quotes as a small table when more than one exists, cheapest highlighted
- [ ] Money engine uses the **lowest** quote for TMC, with a `2 quotes` chip next to the rent so the choice is visible
- [ ] `Keep separate` is remembered — never prompt for that pair again (`point.notDuplicateOf: string[]`)
- [ ] Name similarity is a secondary signal, not required: 80 m with no name match still prompts

## Files

- `app/model.js` — add `quotes[]` and `notDuplicateOf[]` to the schema
- `app/lib/money.js` — `effectiveRent(point)` picks the lowest quote
- `app/ui/form.js` — proximity check on save
- `app/ui/detail.js` — quotes table
- `app/store.js` — `mergePoints(targetId, sourcePoint)`

## Notes

80 m, not 50 m: GPS from a phone inside a building is routinely 40–60 m off, and a false negative (silent duplicate) costs more than a false positive (one dismissed prompt).

Do **not** auto-merge. A chawl with four PGs in one lane is real, and auto-merging would destroy correct data to fix a cosmetic problem.

Rejected approach: a periodic "find duplicates" scan. Catching it at the moment of entry is when the user still has the context to answer.
