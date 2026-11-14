# T-008 — WhatsApp paste parser + visit checklist

**Status:** done · **Priority:** P1 · **Estimate:** M · **Governed by:** ADR-0006

## What shipped

**`app/lib/parse-whatsapp.js`** — paste a broker's message, get proposed values as confirmable chips. Extracts rent, deposit, brokerage, sharing, food, phone, gender, locality (52 MMR localities), amenities, lock-in and notice, plus a suggested name.

Everything arrives **pre-selected but rejectable** — tap a chip to drop it — and nothing is saved until Apply. Each chip carries the text it matched on in its tooltip, so a wrong guess is obvious rather than mysterious.

**Visit checklist** — the same ten ticks at every place, note field per item, count shown in the drawer and compared across columns. Ten checkboxes, no typing.

**Also:** paste a Google Maps link or a bare `19.07, 72.87` anywhere in the app to drop a pin there.

## Verified

`node tests/parse.test.mjs` — **23 assertions pass**, covering a full realistic broker message and the edge cases that matter:

- `15,000` / `15k` / `₹15000` / `1.5L` / a bare `15` all parse correctly
- **`brokerage 1 month` means one month's rent, not ₹1** — and `2 months deposit` works in the reverse word order too
- `brokerage free` and `direct owner` mean **zero**, not unknown
- food left unproposed when the message doesn't mention it — never defaulted to "included"
- a phone number is not mistaken for a rent
- `Andheri East` wins over the substring `Andheri`; `Vile Parle East` likewise
- an empty paste proposes nothing at all

Two real bugs were caught here. The months-as-money case read "brokerage 1 month" as ₹1,000 — worse than reading nothing, since it silently understates a ₹15,000 cost. And the fix itself had an ungrouped regex alternation (`deposit|security[…]`) that matched the bare word with no captured number and produced `NaN`.
