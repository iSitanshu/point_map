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

## Run it

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
- A **visit checklist** so you ask the same 12 questions at every PG instead of remembering half of them.

**Money — the main point**
- *True monthly cost* = rent + all bills + food + commute + (brokerage & setup spread over your expected stay) + the interest you lose on a locked-up deposit.
- *Cash needed on day one* — deposit + brokerage + advance rent + setup. The number that actually decides whether you can move in.
- *Total cost of an 11-month stay*, and net cost after the deposit comes back.
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
| `docs/` | Product spec, data model, brainstorm, setup guides |
| `decisions/` | Architecture Decision Records — *why* each choice was made |
| `tasks/` | The task board: `next/`, `later/`, `done/` |

## Where to start reading

1. [`docs/product-spec.md`](docs/product-spec.md) — what is being built and for whom
2. [`docs/brainstorm.md`](docs/brainstorm.md) — scenario exploration, money modelling options
3. [`decisions/`](decisions/) — the seven decisions that shaped the build
4. [`tasks/BOARD.md`](tasks/BOARD.md) — what's done and what's next
