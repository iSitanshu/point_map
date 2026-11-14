# T-012 — Rent-due reminders via browser notifications

**Status:** next · **Priority:** P1 · **Estimate:** M · **Governed by:** ADR-0008

## Why

The ledger can generate twelve rent rows, but a row only helps if something looks at it. Rent paid late costs a penalty; a deposit not chased is simply lost. ADR-0008 made the case that the post-move-in half is what keeps this app alive past week six — reminders are the mechanism that actually does the keeping.

## Acceptance criteria

- [ ] Settings: `Remind me about rent` → request `Notification.permission` only on that click, never on page load
- [ ] On open, check for ledger rows with `status: due` and `date` within 3 days → one grouped notification: *"Rent ₹15,000 due in 2 days"*
- [ ] Deposit rows with `status: refundPending` past their expected date → *"Deposit ₹30,000 overdue by 9 days"*
- [ ] Clicking a notification focuses the tab and opens the Money view scrolled to that row
- [ ] Never notify twice for the same row — `settings.notifiedRows: {rowId: ISO}`
- [ ] A dismissible in-app banner carries the same information, so the feature works with notifications denied
- [ ] Nothing fires when the app is closed; this is explicitly a check-on-open reminder

## Files

- `app/ui/reminders.js` — new
- `app/ui/money.js` — deep-link to a row
- `app/main.js` — run the check after first render
- `app/model.js` — `notifiedRows` setting

## Notes

Real reminders while the tab is closed need a service worker plus push infrastructure — a server, VAPID keys, a subscription endpoint. That is ADR-0002's whole rejected branch for one notification a month. Check-on-open is 90% of the value at 2% of the cost; if it proves insufficient, T-016 (PWA) is the prerequisite for the real version.

Permission prompt on page load is the classic mistake: it gets denied reflexively and the capability is then unavailable for good.
