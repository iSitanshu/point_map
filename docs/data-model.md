# Data model & cost formulas

Everything the app stores and every number it computes. The schema lives in `app/model.js`; the formulas live in `app/lib/money.js`. This document explains both and is the reference the UI is checked against.

Design rule carried over from [the brainstorm](brainstorm.md): **seven money inputs carry the headline numbers; everything else is optional detail that must never be required.** Unknown is a legal state and is never treated as zero.

---

## 1. Shape of a stored document

```js
{
  version: 1,
  settings: { … },        // §6
  points:   [ Point, … ]  // §2
}
```

Persisted as one JSON blob in localStorage under `point_map.v1`. Uploaded media blobs live separately in IndexedDB (`pointmap-media`), referenced by id.

## 2. Point

| Field | Type | Notes |
|---|---|---|
| `id` | string | `pt_<base36>`, never reused |
| `name` | string | Auto-filled as `Pin near <area>` if left blank |
| `kind` | enum | `pg` \| `food` \| `landmark` \| `office` \| `transit` \| `other` |
| `status` | enum | `lead` \| `toVisit` \| `visited` \| `shortlist` \| `rejected` \| `current` |
| `rejectedReason` | string | Why it was ruled out. **The most valuable field in the dataset** — rejected points are hidden, never deleted. |
| `lat`, `lng` | number | **The only truly required input.** Set by map click, pasted coordinates, or address search. |
| `address`, `area`, `landmark` | string | `area` groups the list (e.g. "Andheri East") |
| `contact` | object | `person`, `phone`, `altPhone`, `source` (`owner`/`broker`/`friend`/`listing`/`walk-in`), `brokerName` |
| `room` | object | `sharing` (1–5), `gender`, `furnished`, `attachedBath`, `ac`, `balcony`, `floor`, `lift` |
| `food` | object | `included` (**tri-state**: `true`/`false`/`null`=unknown), `meals`, `vegOnly`, `kitchenAccess` |
| `costs` | object | §3 |
| `amenities` | string[] | free tags: `wifi`, `washing machine`, `power backup`, … |
| `rules` | object | `gateClosing`, `guests`, `cooking`, `smoking`, `notes` |
| `ratings` | object | 1–5: `safety`, `cleanliness`, `foodQuality`, `water`, `landlord`, `signal` |
| `commute` | object | `minutesToWork` (one way), `nearestStation`, `stationWalkMin` |
| `media` | Media[] | §7 — slot-based |
| `visit` | object | `date`, `done`, `checklist` (slug → `{checked, note}`) |
| `ledger` | LedgerEntry[] | §8 |
| `tags` | string[] | `broker-rahul`, `sunday-visit`, … |
| `notes` | string | free text, searchable |
| `links` | string[] | pasted listing URLs — stored, never scraped |
| `lastVerifiedAt` | ISO date | drives the staleness fade after 21 days |
| `createdAt`, `updatedAt` | ISO string | |

## 3. Cost fields

### The seven that matter

| Field | Meaning |
|---|---|
| `rent` | What **I** pay per month after negotiation — not the room's total |
| `deposit` | Security deposit |
| `brokerage` | Broker's cut. Sunk the moment it's paid. |
| `food.included` | Tri-state. Drives whether the global food estimate is added. |
| `utilities` | **One combined field**: electricity + water + wifi + laundry + maintenance |
| `commuteMonthly` | Round-trip fare × travel days, entered as one monthly figure |
| `settings.stayMonths` | Global, default 12. Not per-point unless overridden. |

Five separate utility fields were deliberately collapsed into one — the reasoning is in [`decisions/ADR-0005`](../decisions/ADR-0005-money-model.md).

### Optional detail (collapsed in the UI, never required)

| Field | Meaning |
|---|---|
| `utilitiesBreakdown` | `{electricity, water, wifi, laundry, maintenance}` — if **any** value is present, its sum overrides `utilities` |
| `advanceMonths` | Months of rent payable upfront (0/1/2/3) |
| `setupCost` | Mattress, bucket, extension board, lock, hangers — realistically ₹3,000–6,000 |
| `foodCostOverride` | Use this place's actual mess cost instead of the global estimate |
| `lockInMonths`, `noticeMonths` | Contract terms; feed the exit-cost line |
| `askingRent` | First price quoted, kept so negotiated savings stay visible |
| `stayMonthsOverride` | Per-point stay length when it differs from the global |
| `depositRefundable` | default `true`; `false` means the "deposit" is really a fee |

## 4. The formulas

`S` = `stayMonthsOverride ?? settings.stayMonths` (default 12).

### Monthly utilities

```
utilitiesEffective = sum(utilitiesBreakdown) if any present
                   else utilities
```

### True Monthly Cost — headline number 1

```
TMC = rent
    + (food.included === false ? (foodCostOverride ?? settings.foodEstimate) : 0)
    + utilitiesEffective
    + commuteMonthly
    + brokerage / S
    + setupCost / S
    + depositHaircut                      // only if settings.depositHaircutPercent > 0
```

where `depositHaircut = deposit × (depositHaircutPercent/100) / S`.

Note what is **not** in TMC: deposit opportunity cost. ₹50,000 at 7% is ₹292/month and will never flip a decision against a ₹3,000 rent gap, so it is a toggleable footnote, not part of the headline. The *size* of the deposit is surfaced through day-one cash instead, which is a real constraint. The optional "X% of the deposit never comes back" toggle (0/10/25%) *is* in TMC when enabled, because 25% of ₹52,000 over 12 months is ₹1,083/month — that can flip a decision.

### Day-one cash — headline number 2

```
cashDayOne = deposit + brokerage + setupCost + rent × max(advanceMonths, 1)
```

### The three lenses

Never one score. The app shows all three and lets the numbers disagree:

```
cashTMC   = TMC                                              // lens 1: pure cash
timeTMC   = TMC + (minutesToWork × 2 × commuteDays / 60) × settings.timeValuePerHour
adjTMC    = timeTMC − (room.sharing === 1 ? settings.privacyPremium : 0)
```

`timeValuePerHour` defaults to 0 and the user is prompted once. `privacyPremium` is the user's own stated answer to "I'd pay ₹___/month extra for a single room" — visible, arguable, never invented by the app.

### Confidence, not false precision

Missing inputs are counted, never zeroed:

```
known   = how many of the 7 inputs have a value
missing = 7 − known
range   = [TMC_known_only, TMC_known_only + Σ(settings.assumedDefaults for missing)]
```

The UI renders `₹18k–24k · 3 of 7 inputs missing` with a confidence dot (green ≥6/7, amber 4–5, red ≤3). A point with no rent shows `—`, not ₹0, and is excluded from averages.

### Exit cost

```
exitCost(N) = max(0, lockInMonths − N) × rent + noticeMonths × rent
```

Shown as a single red line on any point with `lockInMonths > 3`. A 6-month lock-in at ₹26,000 left in month 3 costs ₹1,04,000 — three unserved months plus one month's notice. Worth one line of UI.

### Totals and budget

```
totalOutlay = (recurringPart) × S + brokerage + setupCost + deposit
netCost     = totalOutlay − (depositRefundable ? deposit × (1 − haircut) : 0)
budgetDelta = TMC − settings.budgetMonthly        // negative is good
```

### Worked example — three real-shaped Mumbai options (work: BKC)

| | **A · Andheri E**<br>3-share, food incl. | **B · Powai**<br>single, no food | **C · Mira Road**<br>2-share, food incl. |
|---|---|---|---|
| Rent | 15,000 | 26,000 | 9,500 |
| Food (est. 6,000 if not incl.) | 0 | 6,000 | 0 |
| Utilities | 800 | 3,000 | 1,000 |
| Commute cash | 1,540 | 2,640 | 3,400 |
| Brokerage ÷ 12 | 1,250 | 0 | 792 |
| Setup ÷ 12 | 333 | 500 | 292 |
| **TMC (cash lens)** | **₹18,923** | **₹38,140** | **₹14,983** |
| Deposit | 30,000 | 52,000 | 19,000 |
| **Day-one cash** | **₹64,000** | **₹84,000** | **₹41,500** |
| One-way commute | 25 min | 40 min | 75 min |
| **TMC + time @ ₹150/hr** | **₹21,673** | **₹42,540** | **₹23,233** |

C is ₹3,940/month cheaper on cash. Price commute time at ₹150/hr and **A wins**. And A needs ₹22,500 more on day one than C, which may be the binding constraint regardless. Three lenses, three different winners — showing all three instead of picking one is the app's reason to exist.

Every figure in that table is asserted in `tests/money.test.mjs`, so the code and this document cannot drift apart. (The brainstorm quotes one or two of them a rupee higher: it rounded each line before adding up, the engine adds up and then rounds.)

## 5. Visit checklist

Ten ticks, no typing, identical at every PG. Highest value per unit of effort in the app:

`water pressure` · `mobile signal inside the room` · `window to outside` · `plug points near bed` · `bathroom smell` · `noise at night` · `lock on the door` · `kitchen access` · `lift / which floor` · `walk to station`

Stored as `visit.checklist[slug] = {checked, note}`.

## 6. Settings

| Setting | Default | Used for |
|---|---|---|
| `budgetMonthly` | 20000 | Budget line, over/under colouring |
| `stayMonths` | 12 | `S` in amortisation and totals |
| `foodEstimate` | 6000 | Added to any point where food is not included |
| `utilitiesAssumed` | 1200 | Range upper bound when utilities unknown |
| `commuteDays` | 22 | Travel days per month |
| `timeValuePerHour` | 0 | Commute-time lens; prompted once |
| `privacyPremium` | 0 | Credit for a single room in the adjusted lens |
| `depositHaircutPercent` | 0 | "X% of the deposit never comes back" (0/10/25) |
| `depositRate` | 7 | Opportunity-cost footnote only |
| `pillCap` | 25 | Max price pills drawn in the viewport before dropping to dots |
| `showRejected` | false | Rejected points are hidden, never deleted |
| `workPin` | null | `{lat, lng, label}` — enables distance-from-work |
| `mapProvider` | `auto` | `auto` \| `google` \| `osm` |
| `city` | Mumbai | Initial centre/zoom |
| `lastBackupAt` | null | Drives the backup nag |
| `writesSinceBackup` | 0 | Auto-export prompt every 10th write |

## 7. Media — slots, not a gallery

```js
{ id, slot, type, src, caption, addedAt }
```

Slots: `room`, `bathroom`, `kitchen`, `entrance`, `street-night`, `walk-to-station`, `other`. The bathroom and night-street shots are the ones people forget to take and the ones that decide it, so the UI asks for them by name.

| `type` | `src` holds | Rendered as |
|---|---|---|
| `image` | URL or `media/front-gate.jpg` | `<img loading=lazy>` |
| `video` | URL or `media/walkthrough.mp4` | `<video controls preload=none>` |
| `embed` | YouTube / Drive link | `<iframe>`, auto-converted to embed form |
| `local` | `idb:<mediaId>` | Blob from IndexedDB via object URL |

Limits: 10 items per point, images compressed client-side to 1600px, videos warned above 30s. `local` blobs are not inlined into the JSON export — the export keeps the reference and the Settings panel offers "download all local media" so nothing is trapped. Trade-off recorded in [`decisions/ADR-0007`](../decisions/ADR-0007-media-handling.md).

## 8. Ledger entry

```js
{ id, date, category, amount, status, splitN, proof, note }
```

- `category` ∈ `rent` | `deposit` | `brokerage` | `electricity` | `water` | `wifi` | `food` | `setup` | `other`
- `status` ∈ `due` | `paid` | `owedToMe` | `refundPending` | `refunded`
- `splitN` — entering ₹1,800 split 3 ways creates the expense plus a single "roommates owe me ₹1,200" figure. No settlement graph, no Splitwise clone.
- `proof` — a media id (the UPI screenshot *is* the rent receipt)

Rent rows for the whole stay are auto-generated from `rent` + a due day when a point becomes `current`. One tap marks a row paid. Deposit rows carry an expected refund date and a deduction log.

## 9. Migration policy

The document carries `version`; `store.js` runs `migrate()` on load, applying steps in order and backfilling defaults. Adding an *optional* field needs no migration — `getPath()` returns `undefined` and the UI shows `—`. Only renames and type changes need a step.
