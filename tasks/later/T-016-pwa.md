# T-016 — PWA: installable, offline tiles

**Status:** later · **Priority:** P2 · **Estimate:** M · **Governed by:** ADR-0003

## Why

Journey (b) from the brainstorm: standing outside a PG with one bar of signal. Data already works offline (localStorage), but the *app shell* and the *map tiles* do not — so the page may not load at all, and if it does the map is blank. That is the moment the notes get written, so it is the moment the app most needs to work.

Also the prerequisite for real background reminders (T-012).

## Acceptance criteria

- [ ] `manifest.json` with icons; installable to a phone home screen
- [ ] Service worker caching the app shell (HTML/CSS/JS) cache-first
- [ ] Map tiles cached stale-while-revalidate, capped at ~50 MB with LRU eviction
- [ ] Visible offline indicator; no spinner ever blocks a write
- [ ] Update prompt when a new version is deployed — never a silently stale shell
- [ ] Works as a plain website with the service worker unregistered

## Files

`sw.js` (new) · `manifest.json` (new) · `index.html` · `app/main.js`

## Notes

Service workers are the one place where "no build step" (ADR-0003) hurts: no bundler means hashing the asset list by hand. Keep an explicit `PRECACHE` array and accept that adding a file means adding a line.

Tile caching must respect OSM's tile usage policy — cap the cache, never bulk-prefetch a region.

A stale service worker serving old JS is the classic failure. Version the cache name and `skipWaiting` only after the user accepts the update prompt.
