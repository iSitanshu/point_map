# ADR-0004 — Three-tier zoom detail, colour by status, 25-pill cap

**Status:** Accepted · **Date:** 2026-11-14

## Context

The user's words: *"we can minimise it when in the map so that it'll look readable and tidy."* That is the whole problem statement for the map layer. Thirty to forty PGs spread from Mira Road to Powai, viewed on a laptop at city zoom and on a phone at street zoom, must be scannable in both.

The failure mode is specific and well known: every marker shows a label, labels overlap, and the map becomes grey soup that the user stops opening.

## Options considered

| Option | Verdict |
|---|---|
| **Plain dots everywhere** | Perfectly tidy, tells you nothing. You have to click every pin to find the ₹9,500 one. Rejected. |
| **Always-on price pills** | Maximum information, collides badly at city zoom — exactly the soup to avoid. Rejected alone. |
| **Standard marker clustering** | Tidy at every zoom, but clustering hides the single cheapest option inside a bubble — it hides the thing you are looking for. Rejected as the primary mechanism. |
| **Zoom-dependent level of detail + a hard pill cap** | **Chosen.** |

## Decision

**Three tiers driven by zoom:**

| Zoom | Marker |
|---|---|
| ≤ 11 (whole MMR) | Cluster bubble — count + median rent, e.g. `7 · ₹14k` |
| 12–14 (suburb) | Price pill `₹15k`, status as a coloured left border/ring |
| ≥ 15 (street) | Expanded pill `₹15k · 3-share` with a thumbnail if one exists |

**Colour encodes status, not price.** Price is already written on the pill, so spending colour on it is redundant; status changes daily and is what the eye hunts for. Grey `lead` · blue `to visit` · amber `visited` · green `shortlist` · red `rejected` · purple `current home`.

**A hard cap of 25 pills in the viewport** (`settings.pillCap`). Beyond that, pills degrade to dots with a `28 here` chip. This is the specific mechanism that prevents soup, and it is a cap on *rendered labels*, not on data.

**Supporting rules:**
- Rejected pins hidden behind a toggle, never deleted — the "why rejected" note is the research asset (see ADR-0005 and the data model).
- Selected pin scales to 1.15 and raises its z-index; everything else drops to 55% opacity.
- Overlapping pins at zoom ≥ 12 are nudged apart rather than clustered — three PGs in one lane is real and useful information.
- The side list is synced to the map: filtered to the viewport, sorted by true monthly cost ascending, and hovering a row pulses its pin. The list is what makes the dot tiers acceptable, because the cheap option is always readable *somewhere* on screen.
- Points older than 21 days fade slightly (`lastVerifiedAt`) — stale PG listings are worse than missing ones.

## Consequences

**Accepted:**
- Marker appearance logic is non-trivial and lives in one place (`app/map/marker-view.js`) shared by both providers. A bug there shows up on every pin at once — which is also why it is only one file to fix.
- The zoom thresholds and the cap are tuned for Mumbai's spread at a laptop viewport. On a small phone, 25 pills is still too many; `pillCap` is a setting so it can be lowered without a code change.
- Median-rent-in-cluster can mislead when a cluster mixes a ₹9k and a ₹38k option. Accepted because the tier exists only for orientation, and one zoom step resolves it.

**Gained:**
- The map answers "where are the cheap ones?" at a glance, at every zoom, without a click.
- Status colouring makes the pipeline visible as a map, which turns out to be the main daily use: *what have I not visited yet, and are they near each other?*

## Revisit if

The dataset passes ~100 points (then real clustering at tier 2 becomes necessary), or the user reports that colour-by-price would be more useful — in which case colour becomes a toggle rather than a rewrite.
