# point_map

A map-first website for tracking places you care about — built for the specific job of **finding a PG in Mumbai without losing track of money**.

Drop a pin for every PG a broker sends you, store everything you know about it (name, phone, rent, deposit, food, photos, videos, your own notes), and the app works out what each option *actually* costs you per month — not just the advertised rent.

```
┌─────────────────────────────────────────────────────────────┐
│  Point Map        [ Map ]  Compare   Money        + Add     │
├──────────────┬──────────────────────────────────┬───────────┤
│ search…      │                                  │ Detail   │
│ ▸ filters    │        ●  ₹12k Andheri           │ drawer   │
│              │                                  │          │
│ ▣ Sai PG     │     ₹9.5k ●        ● ₹14k        │ costs    │
│   ₹12,000    │                                  │ media    │
│ ▣ Dabbu Veg  │          ●  work pin             │ ledger   │
│   ₹0         │                                  │          │
└──────────────┴──────────────────────────────────┴───────────┘
```

## Use it on your phone

**→ https://isitanshu.github.io/point_map/**

Published automatically from this repo, so your laptop doesn't need to be on. (**First time only:** switch Pages on at *Settings → Pages → Source: GitHub Actions*, then re-run the latest workflow — GitHub blocks workflows from enabling Pages themselves. [Details](docs/use-on-your-phone.md).) Install it to your home screen and it runs full-screen and works with no signal — which is the point, since the moments this app is for happen outside a building, not at a desk.

Android: tap **⤓ Install** in the top bar. iPhone: open in Safari → Share → **Add to Home Screen**.

Your data stays in each device's own browser, so phone and laptop are separate until you export/import. Full detail: [docs/use-on-your-phone.md](docs/use-on-your-phone.md).

## Run it locally

No build step, no npm install, no backend. It is plain HTML + ES modules, so it only needs to be served over `http://` (not opened as a `file://` path).

```bash
cd point_map
python3 -m http.server 8080
# then open http://localhost:8080
```

or

```bash
./start.sh
```

The app works immediately on a free OpenStreetMap base map. To switch to Google Maps, put your key in `app/config.js` — see [docs/setup-google-maps.md](docs/setup-google-maps.md).

## What it does

**Map**
- A pin per location, colour-coded by status (lead → shortlisted → visited → rejected → current home).
- Pins **collapse to small dots when you zoom out** and expand into price pills when you zoom in, so 40 PGs across Mumbai stay readable.
- Click a pin → detail drawer. Click empty map → add a location right there.
- Set a **work pin** once; every location then shows its straight-line distance from work.

**Information per location**
- Flexible by design: a PG stores rent/deposit/food/rules; a park or a mess like *Dabbu Veg* stores opening hours, phone and a video walkthrough. Same app, different `kind`.
- Photos and videos: paste a YouTube/Drive link, reference a file you dropped in `media/`, or upload straight from your phone (stored in the browser's IndexedDB).
- Ratings on the things that actually matter: safety, cleanliness, food, water pressure, landlord, mobile signal.
- A **visit checklist** so you ask the same 10 questions at every PG instead of remembering half of them.

**Money — the main point**
- *True monthly cost* = rent + all bills + food + commute + brokerage and setup spread over your expected stay. Built from **seven inputs**, and it shows you every line that went into it.
- *Cash needed on day one* — deposit + brokerage + advance rent + setup. Frequently the number that actually decides it: the cheapest place per month can be the one you can't afford to move into.
- **Three lenses that are allowed to disagree** — pure cash, commute time priced at your own ₹/hour, and a privacy premium for a single room. Across three realistic Mumbai options the winner changes three times. Showing that is the point.
- Blank means *unknown*, never ₹0 — an incomplete record shows a range and `4 of 7 known`, not a falsely precise total.
- *Net cost of the whole stay* after the deposit comes back, and the exit cost if you leave inside a lock-in.
- Budget line: set your monthly budget once, every option is shown as under/over it.
- **Ledger**: after you move in, log each payment (rent, electricity, water can, wifi). See budgeted vs actually paid, what's still due, and whether your deposit was refunded.
- Export to CSV to send to a parent, or compare two or three shortlisted options side by side.

**Your data**
- Stored locally in your browser. No account, no server, no monthly bill.
- One-click JSON export/import for backup and for moving between laptop and phone.

## Project layout

| Path | What's inside |
|---|---|
| `index.html` | The page shell |
| `app/config.js` | **Edit this** — API key, your budget, default city, work location |
| `app/model.js` | The schema for a location; drives every form automatically |
| `app/store.js` | State, filters, localStorage persistence, import/export |
| `app/lib/money.js` | All cost formulas in one auditable file |
| `app/map/` | Map adapter — `google.js` and `osm.js` behind one interface |
| `app/ui/` | Sidebar list, detail drawer, add/edit form, compare table, money dashboard |
| `app/data/seed.js` | Example locations so the app is never empty on first run |
| `media/` | Drop your own photos/videos here and reference them by filename |
| `sw.js`, `manifest.webmanifest` | Offline support and home-screen install |
| `tools/make-icons.py` | Regenerates the app icons — stdlib only |
| `tests/` | `npm test` — 52 assertions over the cost engine and parser |
| `docs/` | Product spec, data model, brainstorm, setup guides |
| `decisions/` | Architecture Decision Records — *why* each choice was made |
| `tasks/` | The task board: `next/`, `later/`, `done/` |

## Where to start reading

1. [`docs/use-on-your-phone.md`](docs/use-on-your-phone.md) — install it, and how your data moves between devices
2. [`docs/product-spec.md`](docs/product-spec.md) — what is being built and for whom
3. [`docs/brainstorm.md`](docs/brainstorm.md) — scenario exploration, money modelling options
4. [`decisions/`](decisions/) — the eight decisions that shaped the build
5. [`tasks/BOARD.md`](tasks/BOARD.md) — what's done, what's next, and what is deliberately not being built
