# ADR-0002 — Local-first storage, no backend, no accounts

**Status:** Accepted · **Date:** 2026-11-14

## Context

The app has exactly one user storing their own private research — phone numbers of brokers, rent quotes, notes like "landlord seemed shifty". Nothing is shared live, nothing is collaborative, nothing needs to be queried by anyone else. Against that, the brainstorm named **data loss as the single most likely cause of this project's death**: localStorage can be cleared by a browser setting, and iOS evicts IndexedDB from sites it considers inactive after seven days.

So the question is not "local or cloud" in the abstract. It is "what is the cheapest arrangement that cannot lose a month of research".

## Options considered

| Option | Verdict |
|---|---|
| **Supabase / Firebase free tier** | Real durability, cross-device sync. Costs an account, auth flow, a schema to migrate, network error states on every write, and a dependency that can change its free tier. For one user this is a lot of machinery. Rejected for v1. |
| **A JSON file in the user's Google Drive / Dropbox** | Durable and user-owned. Needs OAuth, which needs a registered app, which is the same friction as ADR-0001's billing problem. Rejected for v1. |
| **localStorage only** | Trivial, instant, offline. Loses everything if storage is cleared. Rejected alone. |
| **localStorage + IndexedDB for blobs + aggressive export** | **Chosen.** |

## Decision

The canonical store is the browser:

- Structured data → **localStorage**, one JSON document under `point_map.v1`, written synchronously on every mutation. No debounce, no "unsaved changes" state, no save button.
- Media blobs → **IndexedDB** (`pointmap-media`), because localStorage's ~5 MB quota cannot hold a video.

Durability comes from making export relentless rather than from a server:

1. **One-keystroke backup.** `⌘/Ctrl + S` downloads a timestamped JSON.
2. **Visible staleness.** The top bar shows `last backup: 6 days ago` and turns amber past 7 days. A number the user can see is a better nag than a notification they dismissed.
3. **Write-count trigger.** Every tenth mutation prompts an export, counted in `settings.writesSinceBackup`.
4. **Import is a first-class path**, not an afterthought — the same file moves data between laptop and phone, which makes backups something the user actually uses rather than insurance they ignore.
5. **The export is the schema.** `version` is stamped into every file so a future format can migrate old exports.

## Consequences

**Accepted:**
- No cross-device sync. Moving laptop → phone is an export/import, done consciously. For a search that lasts a few weeks this is tolerable; it would not be for a product.
- A cleared browser profile with no recent export still loses data. The three nags above are the mitigation, and they are honest about being nags rather than guarantees.
- Uploaded media does not travel inside the JSON export (see ADR-0007), so a full migration is two steps, not one.

**Gained:**
- Zero setup, zero cost, zero latency, works on a train with no signal — which is exactly where PG notes get written.
- No account means no privacy surface. Broker phone numbers and "landlord seemed shifty" never leave the laptop.
- Every write is synchronous, so there is no partial-save or conflict state to design for. This removes an entire category of bug.

## Revisit if

The user starts using two devices in the same week, or asks to share the research with a parent more than twice. Either signal justifies a single-table Supabase sync, which the current store shape (`{version, settings, points}`) can be lifted into without reworking the UI.
