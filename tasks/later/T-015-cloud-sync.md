# T-015 — Supabase sync as the canonical store

**Status:** later · **Priority:** P2 · **Estimate:** L · **Governed by:** ADR-0002

## Why

The real fix for the risk ADR-0002 could only mitigate. Today a cleared browser profile with no recent export loses the research, and laptop → phone is a manual export/import. One row in a free-tier Postgres removes both.

## Acceptance criteria

- [ ] Single table `documents(user_key uuid primary key, doc jsonb, updated_at)` — the existing `{version, settings, points}` shape stored whole, no relational modelling
- [ ] `user_key` is a generated UUID kept in localStorage; no login, no email, no password
- [ ] Local write → immediate localStorage, debounced 2 s push
- [ ] On load, newer remote wins with a visible *"synced 4s ago"* indicator; conflict → keep both and let the user pick
- [ ] Fully functional with the network off; sync is an enhancement, never a gate
- [ ] Credentials in `config.local.js`, RLS restricting rows to the key
- [ ] "Disconnect sync" wipes the remote row and keeps local data

## Files

`app/sync.js` (new) · `app/store.js` · `app/config.js` · `app/ui/shell.js`

## Notes

Resist normalising into `points`, `ledger`, `media` tables. One JSON blob is what makes this a day of work instead of a week, and nothing queries the data server-side.

The anon key sits in the client, so RLS by `user_key` is the only thing protecting the row — a guessable key means someone else's data is readable. Use `crypto.randomUUID()`, never a sequence.

Do this *before* a second device becomes a habit, not after.
