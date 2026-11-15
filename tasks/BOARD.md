# Board — point_map

**Updated:** 2026-11-14 · See [README](README.md) for conventions · [Product spec](../docs/product-spec.md) · [Decisions](../decisions/)

## Shipped in v1

| # | Task | Governed by |
|---|---|---|
| T-001 | [Scaffold, spec, decisions, board](done/T-001-project-scaffold.md) | — |
| T-002 | [Schema + money engine](done/T-002-schema-and-money-engine.md) | ADR-0005, ADR-0006 |
| T-003 | [Store, persistence, import/export, backup nag](done/T-003-store-and-persistence.md) | ADR-0002 |
| T-004 | [Map adapter: OSM + Google, zoom LOD markers](done/T-004-map-layer.md) | ADR-0001, ADR-0004 |
| T-005 | [Sidebar, filters, detail drawer, inline editing](done/T-005-browse-and-edit.md) | ADR-0006 |
| T-006 | [Media slots across three storage routes](done/T-006-media.md) | ADR-0007 |
| T-007 | [Compare view + money dashboard + ledger](done/T-007-compare-and-money.md) | ADR-0005, ADR-0008 |
| T-008 | [WhatsApp paste parser + visit checklist](done/T-008-fast-capture.md) | ADR-0006 |
| T-010 | [Staleness fade + "still available?" ping](done/T-010-staleness-ping.md) | ADR-0004 |
| T-016 | [PWA: installable on a phone, offline, auto-deployed](done/T-016-pwa.md) | ADR-0003 |
| T-018 | [Phone layout fixes, area search, stations, my location](done/T-018-mobile-usability.md) | ADR-0004 |

## Next

| # | Task | Priority | Est |
|---|---|---|---|
| T-015 | [Cloud sync — phone and laptop share one dataset](next/T-015-cloud-sync.md) | **P0** | L |
| T-009 | [Duplicate-pin merge prompt](next/T-009-duplicate-merge.md) | P1 | S |
| T-011 | [Read-only share / print view, contacts redacted](next/T-011-share-view.md) | P1 | M |
| T-012 | [Rent-due reminders via browser notifications](next/T-012-rent-reminders.md) | P1 | M |
| T-013 | [Voice notes with lazy transcription](next/T-013-voice-notes.md) | P2 | M |

## Later

| # | Task | Priority | Est |
|---|---|---|---|
| T-014 | [Commute time via Google Distance Matrix](later/T-014-commute-api.md) | P2 | M |
| T-017 | [Places autocomplete for addresses](later/T-017-places-autocomplete.md) | P2 | S |

## Not doing

Recorded so the same ideas are not re-litigated. Full reasoning in [brainstorm §5](../docs/brainstorm.md) and [ADR-0005](../decisions/ADR-0005-money-model.md).

| Idea | Why not |
|---|---|
| Accounts, auth, multi-user | One-person app. A share link (T-011) covers the one real need. |
| Composite "PG score" | Unexplainable numbers destroy trust. Two headline numbers instead. |
| Splitwise-style settle-up graph | One "roommates owe me ₹X" total is enough; Splitwise exists. |
| Scraping 99acres / NoBroker / Magicbricks | ToS risk, breaks monthly. Store the listing URL instead. |
| Commute isochrone heat layer | Beautiful; does not change the decision. |
| Bank-SMS auto-import of payments | Permissions, privacy, fragility. One tap is cheaper. |
| AC seasonality + rent-hike projection | Fields that stop getting filled in by week three. |
| Draw-a-polygon area notes | A pin with a note already does the job. |

## Verification status

| | |
|---|---|
| Cost engine | **52 assertions pass** — `npm test`. Every figure in `docs/data-model.md` is asserted, so code and docs cannot drift. |
| Module wiring | All 22 modules parse; all 210 named imports checked against actual exports; all 75 import/asset paths resolve. |
| Served app | `index.html` and every asset return 200 over a static server. |
| **In a real browser** | **Not yet run.** Browser automation was unavailable in the build session, so the interactive layer — map tiles, pin rendering, drag, file upload — has not been exercised by a human or a headless browser. First run is the outstanding check: `./start.sh`, open the console, report anything red. |

## Current risks

| Risk | Status |
|---|---|
| Data loss (localStorage cleared) | Mitigated — one-key export, backup age in the top bar, prompt every 10th write. **Not eliminated**, and now sharper: phone storage is evicted more aggressively than laptop storage. T-015 is the real fix. |
| Phone and laptop hold different data | **Open, and now the top priority.** Export/import is the only bridge today. T-015. |
| Field fatigue → abandonment | Mitigated — one required field, 7 money inputs, completeness ring instead of validation. Watch whether records stay sparse. |
| Abandonment after move-in | Mitigated — ledger shipped in v1 (ADR-0008). T-012 is the follow-through. |
| Stale PG listings | Mitigated — pins fade past 21 days, a one-tap WhatsApp "still available?" and a "confirm still listed" action (T-010). |
| IndexedDB eviction losing uploaded media | Open — documented at the point of upload; links recommended for anything important. |
