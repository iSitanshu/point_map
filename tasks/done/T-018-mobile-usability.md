# T-018 — Phone layout fixes, area search, stations, my location

**Status:** done · **Priority:** P0 · **Estimate:** M · **Governed by:** ADR-0004

## Why

Reported from a real phone: *"on clicking on a particular area it is not opening
the form"*, *"unable to edit the options"*, *"the default view displays a global
world map"*.

The first two were the same defect, and it was not in the form at all.

## The bug

`.app` is a CSS grid with no declared columns. A grid item's default
`min-width: auto` refuses to shrink below its content's min-content width, so
the single implicit column sized itself to the top bar's `white-space: nowrap`
content — **737px** — and the entire app laid out 737px wide inside a 390px
phone. Everything was shifted sideways, so taps landed somewhere other than
where they appeared. The form was never broken; it was unreachable.

Measured, not guessed: `documentElement.clientWidth: 390` against
`body.scrollWidth: 737`, via a Chrome DevTools Protocol driver.

A second defect fell out of the same investigation: **`[hidden]` has no
specificity**, so `.chip { display: inline-flex }` silently overrode it. The
offline chip, the Install button and the compare badge were all permanently
visible, and a `.topbar__desk { display: none }` rule lost to `.chip` because
components.css loads after base.css.

A third, same root cause as the first: `.modal-overlay`'s `auto` grid column
sized to the modal's 640px max-content, so `max-width: 100%` resolved against
640px instead of the screen — the dialog was 640px wide on a 390px phone.

## Fixed

- [x] `grid-template-columns: minmax(0, 1fr)` on `.app`, `min-width: 0` on every shrinkable child
- [x] `[hidden] { display: none !important }` as a global reset
- [x] `.modal-overlay` column constrained; modal uses `width: min(…, 100%)`
- [x] Filter panel pinned to the viewport on phones instead of to its own 61px button
- [x] Drawer is a **bottom sheet** (66dvh) with a grab handle, not a full-screen takeover with one small ✕ — previously, opening a pin made the map unreachable
- [x] Top bar compacts: reference chips move to Money → Your data, Add becomes an icon
- [x] Leaflet's zoom buttons moved to bottom-right, out from under the new search bar

## Added, because they were asked for

- [x] **Area search** — type a locality, the map and the list both move there and stay. A chip shows the area with a radius selector; everything outside it is hidden until cleared.
- [x] **My location** — a ◎ button, with the option to make it the search area
- [x] **Stations** — rail and metro, fetched from OpenStreetMap via Overpass and cached for two months, so no coordinate is typed from memory. Drawn quietly beneath the pins; toggleable.
- [x] **Opens where you left it** — the map position is remembered, so it never opens on a world view again. Saved quietly: panning is not an edit and must not trigger the backup nag.
- [x] Demo data is Mumbai-only and removable in one tap, leaving your own places untouched

## Verified

A CDP driver (`scratchpad/drive-mobile.mjs`) performing real touch events at
390x844:

| | Before | After |
|---|---|---|
| `body.scrollWidth` | 737 | 390 |
| Horizontal overflow | **yes** | no |
| Map width | 737 | 390 |
| Modal width | 640 | 350 |
| Tap empty map → form | unreachable | opens |
| Drawer covers the map | yes | no |
| Page errors | none | none |

Desktop behaviour re-tested unchanged. 52 unit assertions still pass.

## Note for next time

Both the layout bugs were the same mistake in two places: **an `auto`-sized grid
track sizing itself to its content's min/max-content instead of its container.**
Worth checking any new grid container for `minmax(0, …)`.
