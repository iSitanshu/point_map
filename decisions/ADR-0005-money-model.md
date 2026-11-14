# ADR-0005 — Seven money inputs, two headline numbers, three lenses

**Status:** Accepted · **Date:** 2026-11-14

## Context

This is the decision the project exists for. The user's ask was *"manage money expenses easily without a headache"* — two requirements in tension. **Easily** pushes toward one big number. **Without a headache** pushes toward few inputs. Accuracy pushes toward many inputs and many numbers.

The thing that makes it necessary at all: advertised rents are not comparable. A ₹9,500 2-share in Mira Road and a ₹15,000 3-share in Andheri with food included are two thousand rupees apart in opposite directions depending on which costs you count.

## Options considered

| Option | Verdict |
|---|---|
| **Full expense model** — itemised utilities, AC seasonality, annual hike projection, GST, deposit NPV | Most accurate. Roughly 20 fields per PG. The user stops filling them in by week three and the app dies with half-empty records. Rejected. |
| **One composite "PG score"** (weighted cost + ratings + commute) | Single glanceable number. Fails the moment a parent asks "why 7.4?" — unexplainable numbers destroy trust. Rejected outright. |
| **Rent only, like every listing site** | Zero headache, zero insight, and the exact problem being solved. Rejected. |
| **Seven inputs → two headline numbers → three optional lenses** | **Chosen.** |

## Decision

### Seven inputs

`rent` · `deposit` · `brokerage` · `food.included` · `utilities` (one combined field) · `commuteMonthly` · `stayMonths` (global, default 12).

Electricity, water, wifi, laundry and maintenance collapse into **one** `utilities` field. An itemised breakdown exists, is collapsed by default, and overrides the single field only if the user actually fills part of it in. Five fields that each get filled in 40% of the time are worse than one field filled in 90% of the time.

### Two headline numbers, never one

```
TMC        = rent + food(if not included) + utilities + commute
             + brokerage/S + setup/S + optional deposit haircut
cashDayOne = deposit + brokerage + setup + rent × max(advanceMonths, 1)
```

Day-one cash is co-headline rather than a detail because it is frequently the *binding* constraint — the cheapest option per month can be the one you cannot afford to move into. In the worked example in the data model, the monthly winner needs ₹22,500 more on day one than the runner-up.

### Three lenses, allowed to disagree

`cash TMC` · `+ commute time priced at ₹/hr` · `+ privacy premium credited to single rooms`. All three are shown; the app does not pick. Across three realistic Mumbai options the winner changes three times depending on the lens, and **surfacing that disagreement is the product**.

The two normalisation knobs are *user-stated, visible and arguable*: one global food estimate (₹6,000, applied identically to every no-food place) and one "I'd pay ₹___/month extra for a single room" figure. Consistency matters more than being absolutely right, and an assumption the user typed is one they can defend.

### Deposit opportunity cost: demoted to a footnote

₹50,000 at 7% is ₹292/month — 2% of rent. It will never flip a decision against a ₹3,000 rent gap, so including it in the headline buys false sophistication at the cost of a number nobody can verify. It renders as a toggleable footnote instead.

What *is* offered is a **deposit haircut toggle** (0/10/25%): "assume X% never comes back". At 25% of ₹52,000 over 12 months that is ₹1,083/month, which genuinely can flip a decision. This is the honest version of the same concern.

### Explicitly cut

Per-item utilities as required fields · AC seasonality maths · GST/TDS · inflation and rent-hike projection · rent-vs-buy NPV · deposit opportunity cost in the headline · any weighted composite score · multi-currency · interest on advance rent · a full roommate settle-up graph.

Each of these is a field or a concept the user would abandon, and an abandoned field makes the whole record untrustworthy.

### Missing data is missing, never zero

A point with no rent shows `—`, not ₹0, and is excluded from averages. TMC with gaps renders as a range with a count — `₹18k–24k · 3 of 7 inputs missing` — and a confidence dot. Silently treating unknown as zero would make the cheapest-looking option the one with the least information, which is the worst possible failure for this app.

## Consequences

**Accepted:**
- `utilities` as a single estimate is less accurate than itemising. Deliberate; the breakdown is one click away for the one or two finalists where precision actually matters.
- Three lenses means three numbers on screen, which is more cognitive load than one. Mitigated by making the cash lens the default and the other two opt-in via settings that start at zero.
- The food estimate is a guess. It is a *consistent* guess applied identically everywhere, which is what comparison requires.

**Gained:**
- Every figure is traceable: one formula file, inputs rendered inline next to each result, nothing hidden. This survives the "why ₹20,700?" question, which is the real acceptance test.
- Seven fields is enterable in under a minute from a broker's WhatsApp message, so records stay complete enough to trust.

## Revisit if

The user finds themselves overriding the food estimate on most points (then it should be per-point by default), or starts tracking a second property — at which point the ledger, not the estimator, becomes the centre of the app.
