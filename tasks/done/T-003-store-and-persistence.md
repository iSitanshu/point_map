# T-003 — Store, persistence, import/export, backup nag

**Status:** done · **Priority:** P0 · **Estimate:** M · **Governed by:** ADR-0002

## What shipped

- `app/store.js` — one state object, a `Set` of listeners, and a `commit()` that mutates, saves to localStorage and notifies in that order. No save button, no dirty state.
- `normalizePoint()` backfills every nested object on load, so the rest of the app reads `point.costs.utilitiesBreakdown.water` without guarding each level — and adding an optional field needs no migration.
- `migrate()` with a version stamp, ready for a format change that needs one.
- Filtering and sorting in one function, so the map, the list and the exports can never disagree about what is visible. Unknown values sort last in every mode.
- JSON export/import, CSV export with 26 columns including the computed figures.
- `backupStatus()` drives three nags: the age shown in the top bar, an amber chip past 7 days, and a prompt every 10th write.
- A failed write (full quota) raises a `save-error` that surfaces as a toast — silence there would mean every subsequent edit is dropped unnoticed.

## Notes

Session-only state (selection, search, filters, open view) is deliberately **not** persisted. A filter that silently survives a reload and hides half the data is worse than one that resets.

Import replaces rather than merges. Merging two divergent copies needs per-point conflict resolution the user would have to adjudicate — out of scope until T-015 makes it a real scenario.
