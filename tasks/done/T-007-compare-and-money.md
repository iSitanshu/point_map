# T-007 — Compare view + money dashboard + ledger

**Status:** done · **Priority:** P0 · **Estimate:** L · **Governed by:** ADR-0005, ADR-0008

## What shipped

**Compare** (`app/ui/compare.js`) — 2 to 4 columns, 19 rows, the two headline numbers first and the active lenses immediately after. The best value in each numeric row is highlighted, but **only when there is a real spread** — highlighting a tie or a lone known value would imply a conclusion the data does not support. A collapsible "how each monthly cost was worked out" shows every line per column, and the assumptions are printed at the bottom in plain words. Built for the moment a parent asks "why ₹20,700?".

**Money** (`app/ui/money.js`) —
- Two headline tiles, plus a third that fires only when the cheapest-per-month and least-cash-on-day-one are different places: *"these disagree"*.
- A ranked bar chart against a dashed budget line, with striped sections showing the uncertainty range where inputs are missing.
- Every assumption editable where its effects are visible: budget, stay length, food estimate, travel days, ₹/hour for time, privacy premium, deposit haircut, staleness threshold, work pin.
- Cross-point ledger roll-up: paid, due, owed-to-me, deposit pending, and a month table with budget-vs-actual and the biggest line named.
- Data panel: JSON backup, import, CSV, media download, storage usage, clear-all.

**Ledger** (`app/ui/ledger-panel.js`) — flat rows with one-tap paid, split-N producing a single "roommates owe me" figure, rent rows generated for the whole stay behind one confirm, and a deposit tracker with an expected date, a countdown and an overdue state.

## Notes

The deposit tracker opens with a line that is the whole argument for its existence: *deposits are lost by forgetting, not by disagreement.*

Rent-row generation is an explicit button rather than automatic on status change — twelve rows of clutter would be the wrong default for someone who prefers logging payments as they happen.
