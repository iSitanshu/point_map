# Product spec — point_map

**Status:** v1 built · **Owner:** Sitanshu · **Last updated:** 2026-11-14

---

## 1. The problem, in one paragraph

I am looking for a PG in Mumbai. Options arrive scattered — a broker's WhatsApp message, a friend's recommendation, a listing site, a board outside a building. Each one has a different set of facts attached (rent, deposit, whether food is included, the landlord's phone number, what the lane looks like at night). Within a week I have fifteen half-remembered options, no sense of where they are relative to each other or to my workplace, and no honest comparison of what each one *costs*, because "₹9,000 rent" and "₹13,000 rent with food and no brokerage" are not comparable numbers. I need one place where every option is a pin on a map, carries its own description, and tells me the truth about money.

## 2. Who it is for

A single user — me. Not a team, not a marketplace, not other people's listings. Every design decision resolves in favour of *one person updating their own notes quickly* over multi-user generality.

Secondary audience: a parent or friend I show the comparison to. They see an exported CSV or a side-by-side table, never the app itself.

## 3. Jobs to be done

| # | Job | Success looks like |
|---|---|---|
| J1 | Capture a new option in under 60 seconds, from a WhatsApp message, possibly on my phone, knowing only half the facts | Drop pin → type name + rent + phone → saved. Everything else optional. |
| J2 | See all options spatially — which cluster is near work, which is an outlier | 40 pins readable at city zoom without overlapping into mush |
| J3 | Store a *different shape* of information per location | A PG stores rent/deposit/food; a park stores hours; a mess stores a menu + video. One schema, optional fields. |
| J4 | Know the real cost of each option, not the advertised one | A single "true monthly cost" number per option, and the day-one cash figure |
| J5 | Compare 2–3 shortlisted options fairly | Side-by-side table where food-included vs food-extra is already normalised |
| J6 | Walk into a visit and ask the right questions | A repeatable checklist attached to each location |
| J7 | Keep using it after moving in | Log actual payments, track bills, chase the deposit refund |
| J8 | Never lose the data | Export/import JSON; nothing locked in a service that can disappear |

## 4. Scope

### In scope for v1 (built)

- Map with pins, three-tier zoom detail (cluster → price pill → pill + thumbnail), status colours, a 25-pill viewport cap, work pin, click-to-add
- Location record where **the pin is the only required input** and seven fields carry the money: rent, deposit, brokerage, food-included, utilities, commute, expected stay. Everything else is optional detail behind collapsed sections.
- Photos and videos by **slot** (room / bathroom / kitchen / entrance / street-at-night / walk-to-station): external links (YouTube/Drive/any URL), local files in `media/`, and direct uploads held in IndexedDB
- Paste a broker's WhatsApp message → rent, deposit, sharing, food and phone extracted as confirmable chips
- Search, filter (status / budget / gender / food / sharing / tags / distance from work), sort by true monthly cost
- Cost engine: true monthly cost, day-one cash, three comparison lenses, exit cost, missing-input confidence, budget comparison
- Compare view for up to 4 selected locations, with every assumption visible
- Money view: budget dashboard + payment ledger with splits + deposit-refund tracker + CSV export
- Visit checklist — ten ticks, no typing, identical at every PG
- Local-first storage with JSON export/import, a backup nag, and an auto-export prompt every tenth write

### Explicitly out of scope

| Not building | Why |
|---|---|
| User accounts / login | One user. Auth is pure overhead. |
| A server or database | Nothing here needs to outlive the browser or be shared live. See `decisions/ADR-0002`. |
| Scraping listing sites | Terms-of-service risk, brittle, and the bottleneck is *deciding*, not *finding*. |
| Real-time commute time via Routes API | Needs a billed API key for a number I can eyeball once. Straight-line km + a manual "minutes to work" field covers it. |
| Multi-currency | Rupees only. |
| Mobile app | The web app is responsive; a wrapper adds build complexity for nothing. |
| Sharing a live link with others | CSV/JSON export is enough for the one time it matters. Revisit if it comes up twice. |

## 5. Core concepts

**Point** — anything worth a pin. A `kind` field (`pg`, `food`, `landmark`, `office`, `transit`, `other`) decides which field groups are emphasised, but every field stays available. This is what lets *Rajajipuram Gandhi Park* and *Dabbu Veg, C Block* and *Sai PG, Andheri* live in the same list without contortion.

**Status** — the pipeline: `lead → toVisit → visited → shortlist → rejected → current`. Status drives pin colour and the default filters, and is the single most-used field in the app. Rejected points are hidden behind a toggle and **never deleted** — the reason something was ruled out is the most valuable note in the dataset.

**Two headline numbers, never one score** — *true monthly cost* and *day-one cash*. A single composite "PG score" is explicitly rejected: an unexplainable number destroys trust the moment someone asks "why ₹20,700?". Defined precisely in `docs/data-model.md` §4, implemented in `app/lib/money.js`, and every figure renders its own inputs inline.

**Ledger entry** — a real payment, actual or planned, attached to a point. This is what turns the app from a search tool into an expense tracker after moving in.

## 6. Key interactions

| Action | How |
|---|---|
| Add a location | Click anywhere on the map, or press `N` |
| Edit | Open a pin → `Edit`, or press `E` while it's selected |
| Shortlist | One click on the status chip in the card or drawer |
| Compare | Tick the compare box on 2–4 cards → `Compare` tab |
| Set work pin | Money/Settings panel → "Set work location" → click the map |
| Back up | `⌘/Ctrl + S` downloads a timestamped JSON |
| Find anything | Type in search — matches name, area, address, phone, tags, notes |

## 7. Non-functional requirements

- **Zero-setup first run.** The app must be useful before any API key exists. Hence the OpenStreetMap default — `decisions/ADR-0001`.
- **No build step.** Clone and serve. Anyone (including me in six months) can change a field label without learning a toolchain — `decisions/ADR-0003`.
- **Fast on a phone over patchy data.** No framework payload; map tiles are the only network dependency.
- **Durable data.** Every write hits localStorage immediately; export is one keystroke; the schema version is stamped into the export for future migrations.
- **Honest numbers.** Every computed figure must be traceable to a formula in `money.js`, and the UI shows its breakdown rather than a magic total.

## 8. Success criteria

The project succeeded if, at the point of signing a PG agreement:
1. Every option I seriously considered is in the app with its true monthly cost.
2. I can state the day-one cash figure for my chosen PG without opening a calculator.
3. I kept using it for the first three months after moving in, to log rent and bills.

If I stop updating it within a week, the cause will almost certainly be *too many required fields* — see `decisions/ADR-0006` and the risk register in `docs/brainstorm.md`.
