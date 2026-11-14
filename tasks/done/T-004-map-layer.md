# T-004 — Map adapter: OSM + Google, zoom-LOD markers

**Status:** done · **Priority:** P0 · **Estimate:** L · **Governed by:** ADR-0001, ADR-0004

## What shipped

- `app/map/index.js` — the controller. Owns every decision about *what* to draw (tier, clustering, pill cap, dimming, work pin) and hands the provider a flat list of `{lat, lng, element, zIndex, onClick}`.
- `app/map/osm.js` — Leaflet + raster OSM tiles. No key, no account, no card. The default.
- `app/map/google.js` — Google Maps with `AdvancedMarkerElement`, used automatically once a key exists. Falls back to OSM with a visible reason if the key is bad, the project unbilled or the referrer blocked.
- `app/map/marker-view.js` — all pin appearance, shared by both providers:
  - zoom ≤ 11 cluster bubble (`7 · ₹14k`), 12–14 price pill, ≥ 15 pill + thumbnail
  - colour by status, price written on the pill
  - hard cap of 25 pills in the viewport, then degrade to dots with an "N here" chip
  - overlapping pins nudged apart on a golden-angle spiral rather than merged
  - selected pin scaled and raised, everything else to 55% opacity; stale pins dashed and faded
- Click empty map to add; click a cluster to zoom into it; paste a Google Maps link anywhere to drop a pin.

## Notes

Keeping marker *appearance* in one shared module is what made two providers affordable — each provider file is under 150 lines and contains no product logic.

Positioning is the one genuinely provider-specific detail: Google anchors a marker's content bottom-centre by itself, Leaflet needs a zero-size icon plus a CSS transform. Both cases are two rules in `components.css`, scoped by the Leaflet class.

A lone point is never hidden inside a cluster bubble, even at city zoom. Clustering that hides the cheapest option hides the thing the user came for.
