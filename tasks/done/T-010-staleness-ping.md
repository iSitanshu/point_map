# T-010 — Staleness fade + "still available?" ping

**Status:** done · **Priority:** P1 · **Estimate:** S · **Governed by:** ADR-0004

## Why

A PG that was available three weeks ago is probably gone. Mumbai PG inventory turns over in days. The current app treats a pin from last month exactly like one from this morning, which means the user can spend an evening comparing options that no longer exist — and then stop trusting the dataset.

`lastVerifiedAt` is already in the schema and already written on every edit. This task makes it *visible* and gives it a one-tap refresh.

## Acceptance criteria

- [x] Pins with `lastVerifiedAt` older than 21 days render at 60% opacity with a dashed border
- [x] Sidebar cards for stale points show a `verified 24d ago` chip in amber
- [x] Detail drawer has a **"Still available?"** button that:
  - [x] opens `https://wa.me/91<phone>?text=<prefilled>` in a new tab when a phone exists
  - [x] prefills: *"Hi, is the PG at <area> still available? (₹<rent>/month)"* — URL-encoded
  - [x] falls back to `tel:` on a device with no WhatsApp
- [x] A **"Confirm still available"** action sets `lastVerifiedAt = now` without opening the edit form
- [x] The staleness threshold is a setting (`settings.staleAfterDays`, default 21)
- [x] Sort option: *oldest verified first*, so a "chase these" pass is one click
- [x] Rejected and `current` points are exempt from fading — staleness is meaningless for both

## Files

- `app/map/marker-view.js` — stale styling
- `app/ui/list.js` — chip + sort option
- `app/ui/detail.js` — the two buttons
- `app/lib/util.js` — `daysSince(iso)`
- `app/model.js` — `staleAfterDays` default

## Shipped alongside T-004/T-005

Pulled forward from `next/` because the pieces landed naturally with the marker
renderer and the drawer: `isStale()` was already needed for pin styling, the
"least recently verified" sort was already in the sort list, and the two buttons
were a dozen lines on top. Completing it was cheaper than leaving it half-built
and tracking the remainder.

The threshold is exposed as **Treat as stale after** in Money → Your numbers.

## Notes

Fade, do not hide. A stale pin still carries the lane, the rent and the photos; hiding it loses research to solve a freshness problem.

The WhatsApp deep link needs the number with country code and no `+`, spaces or dashes — normalise with `phone.replace(/\D/g, '')` and prepend `91` only when the result is exactly 10 digits.

Deliberately no automation here. An auto-ping to a landlord without the user reading it first is a bad idea in a market this personal.
