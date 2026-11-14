# T-001 — Scaffold, spec, decisions, board

**Status:** done · **Priority:** P0 · **Estimate:** M

## What shipped

- `docs/product-spec.md` — jobs to be done, scope, and an explicit non-goals table
- `docs/brainstorm.md` — 8 user journeys, money modelling, map readability options, 24 ranked feature candidates, risk register
- `docs/data-model.md` — the schema and every cost formula, with worked Mumbai numbers
- `docs/setup-google-maps.md` — key, restrictions, billing alert, troubleshooting
- `decisions/ADR-0001..0008` — each with the options actually considered and the consequences accepted
- `tasks/` as a folder-as-status board, `README.md` defining the conventions
- `.gitignore`, `start.sh`, `media/README.md`, `package.json` (ESM flag only — no dependencies)

## Notes

The brainstorm corrected the first draft of the plan in three places, and the corrections are the reason the build looks the way it does:

1. Deposit opportunity cost was in the headline figure. It is ₹292/month on ₹50,000 — real but never decisive. Demoted to a footnote; a deposit *haircut* toggle took its place because that one can actually flip a decision.
2. Utilities were five separate fields. Collapsed to one, with the itemised breakdown as optional detail. Five fields each filled 40% of the time are worth less than one filled 90% of the time.
3. The post-move-in half was scheduled as v2. Moved into v1 — a pure search tool is dead the week the user signs a rent agreement (ADR-0008).
