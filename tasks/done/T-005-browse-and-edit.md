# T-005 — Sidebar, filters, detail drawer, inline editing

**Status:** done · **Priority:** P0 · **Estimate:** L · **Governed by:** ADR-0006

## What shipped

**Sidebar** (`app/ui/list.js`) — search across name/area/address/phone/notes/tags; filters for status, kind, budget slider, food, max sharing, distance from work, tags, show-rejected; 8 sort modes; an "on screen only" toggle synced to the map viewport; cards showing TMC, day-one cash, a `5/7 known` confidence count and a budget delta. Hovering a card pulses its pin.

**Detail drawer** (`app/ui/detail.js`) — both headline numbers with their lines rendered inline, the three lenses when enabled, an exit-risk line where lock-in exceeds 3 months, a fact grid, ratings, notes, the rejection reason, amenities, tags, links, the visit checklist, media and payments.

**Negotiation scratchpad** — rent, deposit, brokerage and advance months are editable in the drawer. Typing recomputes both headline numbers on every keystroke and commits on blur, so a live phone call can be answered with a number. Shows what was negotiated off the asking rent, per month and per year.

**Form** (`app/ui/form.js`) — generated entirely from `FIELD_GROUPS`; Essentials and Money open, the rest collapsed; a completeness ring instead of red asterisks; Save never blocked; ⌘/Ctrl+Enter saves; the rejection-reason field appears the moment a status becomes Rejected.

**Field renderers** (`app/ui/fields.js`) — 13 types including a tri-state (Yes / No / **Not sure**) and money inputs that echo the formatted figure live, which is what catches the extra zero in the absence of validation.

## Notes

Deleting warns that setting the status to Rejected keeps the research instead, and says so more firmly for a point that is already rejected.

Panel repaints are whole-subtree, so the drawer's scroll position is explicitly carried across renders — without that, every edit threw the user back to the top.
