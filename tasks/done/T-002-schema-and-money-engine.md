# T-002 — Schema + money engine

**Status:** done · **Priority:** P0 · **Estimate:** L · **Governed by:** ADR-0005, ADR-0006

## What shipped

- `app/model.js` — `FIELD_GROUPS`: 9 groups, ~60 declared fields, each with path/label/type/hint. Forms, the drawer, the compare table and CSV export are all generated from it, so adding a field is one line.
- Taxonomies in one place: statuses with colours, kinds, media slots, the 10-item visit checklist, ledger categories.
- `app/lib/money.js` — every figure the app claims, and nothing computed anywhere else:
  - `tmcBreakdown()` returns the total *and* the lines that produced it, plus `missing[]` and a low/high range
  - `cashDayOneBreakdown()` — the day-one cash figure, likewise itemised
  - three lenses: cash, commute-time-priced, privacy-adjusted
  - `exitCost()`, `netCostOfStay()`, `budgetDelta()`, `ledgerSummary()`, `generateRentRows()`, `depositRefundStatus()`
- `num()` in `lib/util.js` keeps empty distinct from zero — the distinction the whole engine rests on.

## Verified

`node tests/money.test.mjs` — **29 assertions pass**, including the three worked options from `docs/data-model.md`:

| | Andheri | Powai | Mira Road |
|---|---|---|---|
| TMC | ₹18,923 | ₹38,140 | ₹14,983 |
| Day-one cash | ₹64,000 | ₹84,000 | ₹41,500 |
| TMC @ ₹150/hr commute | ₹21,673 | ₹42,540 | ₹23,233 |

The ranking-flip is asserted directly: Mira Road wins on cash by ₹3,940/month, and Andheri wins once commute time is priced. Also asserted: a blank rent yields `null` rather than ₹0, an incomplete record refuses to report an exact total, an itemised utilities breakdown overrides the single estimate, and the deposit *haircut* enters TMC while the deposit *opportunity cost* stays out.

Writing the tests caught one real discrepancy: the exit-cost figure quoted in the brainstorm (₹78,000) omitted the notice period that the documented formula includes. The formula is right at ₹1,04,000; the doc and the seed note were corrected to match.
