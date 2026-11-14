# Point Map — PG Hunting & Money Clarity (Brainstorm)

Solo user. Hunting a PG in Mumbai. Priority: **money clarity without headache**. Must stay useful *after* move-in.

---

## 1. User journeys (8 scenarios)

| # | Scenario | Must be trivial | Abandons the app if… |
|---|---|---|---|
| a | **Broker dumps 5 options on WhatsApp, 11pm, in bed** | Paste the whole message blob → 5 draft pins created with rent/sharing/phone pre-extracted, status `Lead`. Pin location can be "roughly Chakala" and fixed later. | It asks for 12 fields per place, or demands an exact address before saving. |
| b | **Standing outside the PG, 1 bar of network** | Works fully offline: camera → tag shot as `bathroom`/`street at night`, 20s voice note, tick a 10-item visit checklist, set status `Visited`. Syncs later, silently. | A spinner. One lost note = never opens it again. |
| c | **Video call with parent, comparing 3 shortlists** | One "Compare" view: 3 columns, **True Monthly Cost** and **Day-one cash** on top, photos below, assumptions visible. Readable on a shared screen. | Numbers appear without showing where they came from — parent asks "why ₹20,700?" and there's no answer. |
| d | **Negotiating rent on the phone with the owner** | A live scratchpad: change rent/deposit/brokerage and watch TMC + day-one cash move in real time. "If you drop ₹1,000 and I pay 3 months advance" → instant answer. Plus the cheapest comparable nearby as leverage. | Edits require opening a form, scrolling, and pressing Save.
| e | **Month 1 after moving in** | 12 rent rows auto-generated on move-in day; mark paid in one tap; attach the UPI screenshot = your rent receipt. One "₹1,800 electricity, split 3 ways" entry → two ₹600 owed-to-me rows. Budget vs actual for the month. | It feels like accounting software. More than ~30 seconds/week of upkeep. |
| f | **Moving out, chasing a ₹30,000 deposit** | Deposit row with `expected_refund_date = move_out + notice`, a countdown chip, a deduction log ("₹2,000 painting — disputed"), and a prefilled WhatsApp follow-up. | It never reminds. Deposits are lost by forgetting, not by disagreement. |
| g | **Friend asks for the research** | One button: read-only share link / print PDF, **contacts redacted by default**. | Sharing means screenshotting 9 screens. |
| h | **Second broker pitches the same PG** | Duplicate warning on new pin within 80 m + similar rent → "Looks like *Sai Krupa*. Merge?" Keeps both brokers' quotes on one place. | Silent duplicates — the map becomes untrustworthy. |

---

## 2. Money (the core)

### Every rupee a PG actually costs
Rent · security deposit · brokerage · advance months · society maintenance · electricity share · AC summer surcharge · water cans · wifi · laundry · food/mess/tiffin · guest charges · lock-in & notice penalties · commute cash · commute *time* · one-time setup (mattress, bucket, extension board, lock, hangers) · mid-lease hikes.

### The two numbers that matter

```
TMC (true monthly cost)
  = rent
  + (food_included ? 0 : food_estimate)      // one global number, same everywhere
  + utilities_monthly_est                     // ONE field: electricity+wifi+water+laundry+maint
  + commute_cost_monthly
  + brokerage / expected_stay_months
  + one_time_setup / expected_stay_months

DAY-ONE CASH
  = deposit + brokerage + (advance_months × rent) + one_time_setup
```

Optional, off by default: `+ commute_hours_per_month × your_hourly_rate` (time cost), and deposit opportunity cost.

### Worked example — 3 real-shaped Mumbai options (work location: BKC)

| | **A · Sai Krupa, Andheri E (Chakala)**<br>3-share, food incl. | **B · Royal Stay, Powai**<br>single room, no food | **C · Shree PG, Mira Road**<br>2-share, food incl. |
|---|---|---|---|
| Rent | 15,000 | 26,000 | 9,500 |
| Food (est. 6,000 if not incl.) | 0 | 6,000 | 0 |
| Utilities est. | 800 | 3,000 | 1,000 |
| Commute cash (22 days) | 1,540 | 2,640 | 3,400 |
| Brokerage ÷ 12 | 1,250 (15,000) | 0 (direct owner) | 792 (9,500) |
| Setup ÷ 12 | 333 (4,000) | 500 (6,000) | 292 (3,500) |
| **TMC** | **₹18,923** | **₹38,140** | **₹14,984** |
| Deposit | 30,000 | 52,000 | 19,000 |
| Advance (1 mo) | 15,000 | 26,000 | 9,500 |
| **Day-one cash** | **₹64,000** | **₹84,000** | **₹41,500** |
| One-way commute | 25 min | 40 min | 75 min |
| **TMC + time @ ₹150/hr** | **₹21,673** (+18.3 h) | **₹42,540** (+29.3 h) | **₹23,234** (+55 h) |

**The insight the app exists to produce:** on cash, C looks ₹3,900/month cheaper than A. Price commute time at even ₹150/hr and **A beats C**. And A needs ₹22,500 *more* on day one than C — which may be the binding constraint regardless of TMC. Three different winners depending on which number you look at; show all three, don't pick for the user.

### Deposit as locked-up money — model it, but demote it
₹50,000 at 7% = **₹292/month** (2% of rent). It will never flip a decision against a ₹3,000 rent gap. So:
- **Do not** put opportunity cost in TMC. Show it as a footnote line, toggleable.
- **Do** make deposit size prominent — via **day-one cash**, which is a real constraint.
- Optional one toggle: "assume X% of deposit never comes back" (0 / 10 / 25%). At 25% on ₹52,000 over 12 months that's ₹1,083/month — *that* can flip a decision.

### Comparing unlike things — three honest knobs
1. **Food in vs out** → one global `food_estimate` (default ₹6,000) applied to every no-food place. Being internally consistent matters more than being absolutely right.
2. **Single vs 3-sharing** → never auto-normalise, never invent a comfort score. One knob: *"I'd pay ₹___/month extra for a single room"* (e.g. ₹6,000). Show an **Adjusted TMC** column that credits private rooms by that amount. User-stated, visible, arguable. Default view groups by room type.
3. **Further from work** → the time toggle above. Default ₹0/hr; prompt once: "value your commute time?"

### Exit cost
`exit_cost_if_I_leave_in_month_N` = unserved lock-in months × rent (or deposit forfeit, whichever the owner states) + notice-period rent. A 6-month lock-in at ₹26,000 exited in month 3 = ₹78,000 risk. Show as a single red line on any place with lock-in > 3 months.

### After moving in — the minimum ledger
`{date, place_id, category, amount, status (due|paid|owed_to_me|refund_pending|refunded), split_n, proof_image, note}`
- Auto-generate rent rows from `rent_monthly` + `due_day` for 12 months. One tap = paid. UPI screenshot = receipt.
- Budget vs actual: one bar per month (budget = TMC), plus "biggest overrun: electricity +₹900".
- Splitting: enter amount + "split 3 ways" → owed-to-me rows and **one** running "roommates owe me ₹X" total. No settlement graph, no Splitwise clone.
- Deposit refund: countdown + deduction log + prefilled follow-up message.

### The 90% set — 7 inputs
`rent_monthly` · `deposit_amount` · `brokerage_amount` · `food_included` · `utilities_monthly_est` · `commute_cost_monthly` · `expected_stay_months` (global default 12)

**Explicitly CUT:** per-item utility breakdown (5 fields → 1), AC seasonality maths, GST/TDS, inflation & hike projection, rent-vs-flat NPV, deposit opportunity cost in TMC, ROI scores, any weighted total-score ranking, multi-currency, interest on advance. Each of these adds a field the user will stop filling in by week 3.

---

## 3. Map readability (20–40 pins)

Options weighed: plain dots (tidy, useless) · always-on price pills (informative, collide at city zoom) · clusters (hide the one thing you care about) · zoom-dependent LOD · synced side list · colour-by-price vs colour-by-status.

**Recommendation: 3-tier zoom LOD + colour by status + price written on the pill + synced side list.**

| Zoom | Marker |
|---|---|
| ≤ 11 (whole MMR) | Cluster bubble: count + median rent — `7 · ₹14k` |
| 12–14 (suburb) | Price pill `₹15k`, status colour as ring/left-border |
| ≥ 15 (street) | Pill expands: `₹15k · 3-share` + 20px photo thumb |

- **Colour = status, not price.** Price is already printed on the pill; status changes daily and is what you scan for. Grey `Lead` · blue `To visit` · amber `Visited` · green `Shortlisted` · red `Rejected` · purple `Current home`.
- `Rejected` pins hidden behind a toggle, **never deleted** — the "why rejected" note is the most valuable asset in the dataset.
- Overlap at zoom ≥ 12: nudge apart with a 1px leader line rather than clustering — three PGs in one lane is real, useful information.
- Hard cap: max 25 price pills in the viewport; beyond that drop to dots + a "28 here" chip. This is what stops 40-marker soup.
- Selected pin: scale 1.15, raised z-index, everything else to 55% opacity.
- Desktop: hover tooltip (name · TMC · status), click → 420px right drawer. Mobile: tap → bottom sheet at 40% height, drag up for full.
- Side list sorted by TMC ascending, filtered to viewport, hovering a row pulses its pin.

---

## 4. Data entry without headache

- **Exactly one required field: the pin location.** Name auto-fills from reverse geocode ("Pin near Chakala Metro"). Everything else optional, forever.
- **"Unknown" is a first-class value** (`null ≠ 0`). Renders as `—` with a tap-to-fill chip. TMC then shows a **range**: `₹18k–24k · 3 of 7 inputs missing` with a confidence dot. Never silently treat missing as zero.
- **Paste-a-WhatsApp-message**: one big textarea → extract rent (`15000`, `15k`, `₹15,000`), deposit (`dep`/`security`), sharing (`2 sharing`/`single`/`triple`), food (`with food`/`mess`), phone (`[6-9]\d{9}`, `+91`), brokerage (`brokerage free`/`direct owner`), locality (match against a static MMR locality list). Show extracted values as **confirmable chips** — tap to reject. Never auto-save silently.
- Also accept: pasted Google Maps link or lat/long → pin. Pasted listing URL → stored as a link, not scraped.
- **Media slots** rather than a generic gallery: `room`, `bathroom`, `kitchen`, `entrance`, `street at night`, `walk to station`. The bathroom and night-street shots are the ones you forget and the ones that decide it. Client-side compress to 1600px / 720p, 30s video cap, 10 items per place.
- **Voice note** on the spot; transcribe lazily when back on wifi.
- **Progressive disclosure**: Money / Room / Rules / Research as collapsed sections. Completeness ring, not red asterisks.
- **Visit checklist** (10 ticks, no typing): water pressure · mobile signal inside room · window to outside · plug points near bed · bathroom smell · noise at night · lock on door · kitchen access · lift/floor · nearest station walk. Highest value-per-effort feature in the whole app.
- Offline-first: every write lands locally first, syncs opportunistically.

---

## 5. Future features — value vs effort

| Feature | Value | Effort | Verdict |
|---|---|---|---|
| TMC + day-one-cash calculator (7 inputs, visible assumptions) | Very high | Low | **Build now** |
| Status pipeline + rejected-with-reason (kept, not deleted) | High | Low | **Build now** |
| Zoom-LOD price-pill map + synced side list | High | Med | **Build now** |
| Offline-first local store + one-click JSON export/import | Very high | Med | **Build now** |
| Media slots (room/bath/night-street) + compression | High | Low | **Build now** |
| Visit checklist (10 taps) | High | Very low | **Build now** |
| Compare drawer (2–3 side by side) | High | Low | **Build now** |
| Live negotiation scratchpad (edit rent, watch TMC move) | High | Low | **Build now** |
| Payment ledger + auto rent-due rows + UPI-screenshot receipts | High | Med | Build next |
| Deposit-refund tracker with countdown | High | Low | Build next |
| WhatsApp paste parser | High | Med | Build next |
| "Last verified" staleness + one-tap "still available?" ping | Med-high | Low | Build next |
| Read-only share link / print PDF, contacts redacted | Med | Low | Build next |
| Voice notes + lazy transcription | Med | Med | Build next |
| Commute time via Maps Distance Matrix (auto) | Med | Med | Build next — manual `commute_minutes` field first; API key is the bottleneck |
| Duplicate-pin merge prompt | Med | Low | Build next |
| Calendar entries for visit appointments | Low-med | Low | Later, cheap |
| Roommate split with full settle-up graph | Low | Med | **Probably never** — Splitwise exists; keep the one-line "owes me" total |
| Commute isochrone heat layer | Med | High | **Never** — beautiful, doesn't change the decision |
| Scraping NoBroker/Magicbricks/99acres | Med | High | **Never** — ToS risk, breaks monthly, store the URL instead |
| Multi-user accounts, auth, roles, sharing permissions | Low | High | **Never** — it is a one-person app; a share link is enough |
| Price prediction / ML "PG score" | Low | High | **Never** — unexplainable numbers destroy trust (see journey c) |
| Bank-SMS auto-import of payments | Med | High | **Never** — permissions, privacy, fragility; a tap is cheaper |
| Draw-a-polygon area notes ("avoid this lane") | Low | Med | **Never** — a pin with a note does the job |

---

## 6. Risks & cheapest mitigation

| Risk | Cheapest mitigation |
|---|---|
| **Data loss** — localStorage cleared, iOS evicts IndexedDB, phone lost | Auto-export JSON on every 10th write + visible "last backup: 6 days ago" nag + one-click import. Ideally the canonical store is a single JSON/row in the user's own cloud (Supabase free tier or a Drive file). This is existential — do it in week 1. |
| **Maps API key / billing friction** | Use MapLibre GL + free OSM-based tiles (Protomaps/MapTiler free tier). No credit card, no quota panic. Treat Google Distance Matrix as an optional later add-on, not a dependency. |
| **Stale data** — PG filled up two weeks ago | `last_verified_at` on each pin; pins fade after 21 days with a one-tap WhatsApp "still available?" |
| **Field fatigue** — user stops updating, app dies | One required field. 7 money inputs. Completeness ring instead of validation errors. Ruthlessly reject new fields. |
| **Abandonment after move-in** | The ledger + deposit tracker + rent reminders are what keep it alive past week 6. A pure search tool is dead the day the user signs. |
| **Media bloat** | Client-side compression, 10 items/place, 30s video cap, show total storage used. |
| **Unexplainable numbers** | Every derived figure renders its inputs inline and is editable in place. No hidden weights, no composite score. |
| **Privacy when sharing** | Share links redact phone numbers and exact addresses by default; opt-in per field. |
| **Over-modelling money** | The whole TMC formula must fit on one phone screen with every input visible. If it doesn't fit, cut an input. |

---

## 7. Opinionated recommendations (decisions to act on)

**Build:**
1. **Two headline numbers everywhere: True Monthly Cost and Day-one cash.** Never one number, never a score.
2. **Seven money inputs. No more.** rent, deposit, brokerage, food_included, utilities_est, commute_cost, expected_stay.
3. **One required field: the pin.** Unknown is a legal, visible state; TMC degrades to a range with a confidence dot.
4. **Colour pins by status, print the price on the pill, and cap on-screen pills at 25.** Zoom drives detail: cluster → pill → pill+thumb.
5. **Offline-first, local-first, with automatic JSON export and a backup nag.** Data loss is the single most likely cause of death.
6. **Keep rejected places forever, hidden behind a toggle.** The reasons are the research.
7. **Three honest knobs for unfair comparisons:** global food estimate, "privacy premium ₹/month" for single rooms, "₹/hour" for commute time (default ₹0, prompt once).
8. **Ship the post-move-in half:** auto rent rows, one-tap paid, UPI screenshot as receipt, one "roommates owe me" total, deposit countdown.
9. **Edit in place, never a modal form.** Negotiation happens live on a phone call.
10. **MapLibre + free OSM tiles.** No Google billing on the critical path.

**Do not build:** auth/multi-user, a composite PG score, deposit opportunity cost inside TMC, a Splitwise clone, listing scrapers, isochrone layers, AC-seasonality maths, hike projections, bank-SMS import, polygon area notes.

**Sequence:** (1) pin + 7 money fields + TMC/day-one cash + JSON export → (2) map LOD + side list + compare + media slots + visit checklist → (3) ledger + deposit tracker + WhatsApp paste → (4) share link, voice notes, staleness pings.
