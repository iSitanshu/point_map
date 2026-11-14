# T-017 — Places autocomplete for addresses

**Status:** later · **Priority:** P2 · **Estimate:** S · **Governed by:** ADR-0001

## Why

Dropping a pin by hand is accurate and fast on a laptop. Typing *"Sai Krupa PG Chakala"* and getting a location is faster when the address came as text in a WhatsApp message — which is most of the time.

## Acceptance criteria

- [ ] Address field in the add/edit form offers suggestions as you type
- [ ] Google path: Places Autocomplete, biased to the current viewport, `components=country:in`
- [ ] OSM path: Nominatim with a 400 ms debounce, `countrycodes=in`, viewbox bias, attribution shown
- [ ] Selecting a suggestion sets `lat`/`lng`/`address`/`area` and moves the pin
- [ ] The manual map click stays the primary path and is never removed
- [ ] Nominatim failure or rate-limit degrades to a plain text field with no error wall

## Files

`app/ui/form.js` · `app/map/google.js` · `app/map/osm.js` · `app/lib/geo.js`

## Notes

Nominatim's usage policy requires an identifying referer and asks for ≤1 request/second — the debounce is a requirement, not a nicety. Cache results per query string in memory for the session.

Places Autocomplete is billed per session plus per detail request, so wire it to Autocomplete *sessions* rather than firing a Place Details call per keystroke.

Low priority because it saves seconds on a task done forty times, not a blocked workflow.
