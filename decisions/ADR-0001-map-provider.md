# ADR-0001 — OpenStreetMap by default, Google Maps behind one adapter

**Status:** Accepted · **Date:** 2026-11-14

## Context

The brief asked explicitly for a project built on Google Maps. But the Google Maps JavaScript API requires a Google Cloud project with **billing enabled and a credit card on file** before a single tile renders. The user is a student-shaped person hunting for a PG; putting a card-entry flow between them and the first pin is the single most likely way for this project to die at hour one. The brainstorm independently flagged "Maps API key / billing friction" as a top risk and recommended dropping Google from the critical path entirely.

Two requirements therefore pull against each other: *the user asked for Google Maps*, and *the app must work before any key exists*.

## Options considered

| Option | Verdict |
|---|---|
| **Google Maps only** | Matches the brief literally. App is a grey rectangle until billing is set up. Rejected — a non-functional first run is worse than a different base map. |
| **OpenStreetMap only (Leaflet)** | Zero setup, works instantly. Ignores an explicit request, and Google's India data (PG names, small lanes, Street View context) is genuinely better. Rejected. |
| **MapLibre GL + free vector tiles** | The brainstorm's recommendation. No Google billing. But free vector styles either carry a provider key (MapTiler) or are demo-grade (demotiles), so it trades Google's key for someone else's. Heavier library, more moving parts. Rejected. |
| **Both, behind one adapter** | More code than either alone, and two rendering paths to keep working. **Chosen.** |

## Decision

A thin map adapter (`app/map/index.js`) exposes one interface — `setPoints`, `focus`, `onMapClick`, `onMarkerClick`, `getZoom` — with two implementations behind it:

- `app/map/osm.js` — Leaflet + raster OpenStreetMap tiles. **No key, no account, no card.** The default.
- `app/map/google.js` — Google Maps JS API with `AdvancedMarkerElement`. Used automatically as soon as `config.googleMapsApiKey` is non-empty.

`config.mapProvider: "auto"` resolves to Google when a key exists and OSM otherwise, and can be pinned to either.

Leaflet rather than MapLibre for the free path: raster OSM tiles need no style host and no provider key at all, and Leaflet's marker API is a closer match to Google's advanced markers, which keeps the adapter thin. This is a deliberate deviation from the brainstorm's recommendation and the reason is cost of correctness, not preference.

Both providers render **the same marker HTML** from `app/map/marker-view.js`, so the map looks and behaves identically either way. That shared renderer is what makes the two-provider decision affordable.

## Consequences

**Accepted:**
- Two map code paths to maintain. Mitigated by keeping all marker appearance in one shared module and all provider-specific code under 150 lines each.
- Leaflet and the Google SDK both load from a CDN, so the *map* needs network even though the *data* does not. Acceptable: the list, compare and money views work fully offline; only tiles go blank.
- Address search uses Nominatim on the OSM path (free, rate-limited, attribution required) and Google's geocoder when a key is present. Slightly different result quality between paths.

**Gained:**
- First run works with zero setup. The user sees their own pins before deciding whether Google is worth a credit card.
- The brief's request is honoured — Google is one line of config away, documented in `docs/setup-google-maps.md`.
- Provider risk is contained: if Google's pricing or Leaflet's tile policy changes, one file is replaced, not the app.

## Revisit if

Nominatim rate-limits become a daily annoyance, or the user enables billing and never looks back — at which point the OSM path becomes dead weight and can be deleted in one commit.
