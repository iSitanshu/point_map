# T-011 — Read-only share / print view, contacts redacted

**Status:** next · **Priority:** P1 · **Estimate:** M · **Governed by:** ADR-0002

## Why

Two real moments: a video call with a parent who wants to see the three shortlisted options, and a friend who asks for the research. Today both mean screenshotting several screens, which means it does not happen.

This is also the deliberate alternative to multi-user accounts (ADR-0002). If one static page covers the sharing need, auth never has to be built.

## Acceptance criteria

- [ ] **Export shortlist → HTML**: one self-contained file, no JS, no external requests, opens anywhere
- [ ] Contains per point: name, area, photos, TMC with its inputs shown, day-one cash, ratings, the visit checklist, notes
- [ ] **Contacts redacted by default** — phone numbers and the exact street address replaced by `—`, with a checkbox to include them
- [ ] A comparison table at the top: the shortlist as columns, TMC / day-one cash / commute / sharing / food as rows
- [ ] Assumptions block printed in full: *"food estimated at ₹6,000 where not included; stay 12 months; commute time valued at ₹0/hr"* — a parent asking "why ₹20,700?" must find the answer on the page
- [ ] `@media print` rules so `⌘P → Save as PDF` produces something readable: no dark backgrounds, no cut-off tables
- [ ] Images: `local` IndexedDB blobs inlined as data URIs (this file must survive being emailed); remote URLs left as links
- [ ] Filename `point-map-shortlist-YYYY-MM-DD.html`

## Files

- `app/ui/share.js` — new; builds the HTML string
- `app/ui/shell.js` — menu entry
- `app/styles/print.css` — print rules, inlined into the export
- `app/media.js` — `toDataURI(mediaId)`

## Notes

Build it as a string, not by cloning the live DOM: the live DOM carries event handlers, map tiles and CSS the recipient will not have.

Inlining images will produce a multi-MB file. Downscale to 800px on the way in and cap at ~8 MB with a warning — above that, most mail providers reject it.

Rejected: a hosted share link with a URL. It needs a server (ADR-0002) and it leaks broker phone numbers to anyone who guesses the URL. A file the user attaches themselves keeps the data under their control.
