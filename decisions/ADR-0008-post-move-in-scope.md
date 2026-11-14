# ADR-0008 — Ship the post-move-in ledger in v1, not v2

**Status:** Accepted · **Date:** 2026-11-14

## Context

The brief describes a *search* tool: mark PG locations, store descriptions, compare them. The natural v1 boundary is therefore "everything up to signing the agreement", with expense tracking as an obvious v2.

The brainstorm argued the opposite, and convincingly: **a pure search tool is dead the day the user signs.** The search lasts three or four weeks. The tenancy lasts eleven months. Everything that makes this app worth having built — knowing what rent is due, what the electricity share came to, whether the deposit came back — happens *after* the part the brief describes.

There is also a sequencing argument. The highest-stakes money event in the whole journey is the deposit refund, and deposits are lost by *forgetting*, not by disagreement. A tool that was abandoned in month one cannot remind anyone in month twelve.

## Options considered

| Option | Verdict |
|---|---|
| **Search only; ledger in v2** | Smallest v1, matches the brief literally. Highest risk of the app being abandoned the week it is finished, with v2 never written. Rejected. |
| **Full accounting** — recurring-transaction engine, categories hierarchy, double-entry, roommate settle-up graph | Thorough, and it feels like accounting software, which the user explicitly does not want. Rejected. |
| **Point to Splitwise for shared bills** | Splitwise is better at settling up, genuinely. But it does not know the rent, the deposit or the budget, so the user ends up maintaining two tools. Rejected as a dependency, accepted as a boundary (see below). |
| **A deliberately dumb ledger, in v1** | **Chosen.** |

## Decision

The ledger ships in v1 as a flat list of `{ id, date, category, amount, status, splitN, proof, note }` attached to a point. No recurring-transaction engine, no category tree, no double-entry.

Four behaviours earn their place, chosen because each one is where money is actually lost or where upkeep actually dies:

1. **Auto-generated rent rows.** When a point becomes `current`, rent rows for the whole stay are generated from `rent` and a due day. One tap marks a row paid. This is what keeps weekly upkeep under 30 seconds — the alternative, typing the same amount twelve times, is the alternative nobody does.
2. **The UPI screenshot is the receipt.** `proof` holds a media id. No separate receipts feature; the thing the user already has on their phone becomes the record.
3. **One "roommates owe me ₹X" total.** Entering ₹1,800 split 3 ways produces the expense plus a single running figure. Explicitly *not* a settlement graph — that boundary is where Splitwise begins and this app stops.
4. **Deposit-refund tracking.** An expected refund date, a countdown chip, a deduction log ("₹2,000 painting — disputed"), and a prefilled follow-up message. The single highest-value item in the ledger, for the single largest sum in the whole tenancy.

Budget vs actual is one bar per month (budget = TMC from ADR-0005) plus the largest overrun named — *"electricity +₹900"*. That is the whole analytics surface.

## Consequences

**Accepted:**
- v1 is meaningfully larger than the brief, and the search half shipped slightly later than it could have. Judged worth it: the ledger is ~15% of the code and most of the app's lifespan.
- A flat ledger cannot answer "what did I spend on electricity across two PGs in six months" without a scan. At a few hundred rows this is a filter, not a query engine.
- Auto-generating twelve rent rows creates clutter for a user who would rather log payments as they happen. Generation is therefore one explicit button, not automatic on status change.
- Splitting stops at "owed to me". A roommate who pays unevenly needs a second tool, and that is the correct trade.

**Gained:**
- The app has a reason to be opened in month seven, which is the only real test of whether it was worth building.
- The deposit — often the largest single sum in the tenancy — has an owner, a date and a reminder instead of relying on memory.

## Revisit if

The user is still logging payments at month six, which would justify a real recurring-transaction engine and per-category trends. Conversely, if the ledger is untouched one month after move-in, it should be *removed* rather than extended — and that observation is worth recording as a new ADR either way.
