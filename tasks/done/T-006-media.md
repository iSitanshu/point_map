# T-006 — Media slots across three storage routes

**Status:** done · **Priority:** P1 · **Estimate:** M · **Governed by:** ADR-0007

## What shipped

- `app/media.js` — IndexedDB wrapper, type sniffing, embed-URL rewriting, client-side image compression, object-URL caching, storage usage, "download all local media".
- `app/ui/media-panel.js` — the gallery, grouped by slot, with both ways to add: paste a link, or upload from the device.
- Four render paths: `image`, `video`, `embed` (YouTube/Drive/Vimeo rewritten to their embed form), and `local` (IndexedDB blob via object URL, including audio for future voice notes).
- Slots asked for by name: room, bathroom, kitchen, entrance, street at night, walk to station, voice, other.
- Limits enforced quietly: 10 items per place, images downscaled to 1600px, a warning above 60 MB pointing the user at a link instead.

## Notes

Three specific bugs were designed out rather than discovered later:

1. **Sideways photos.** A canvas round-trip drops EXIF, so `createImageBitmap(file, { imageOrientation: "from-image" })` is required or every portrait phone photo comes back rotated.
2. **Leaking object URLs.** One created per render leaks steadily and ends as a crashed tab on a phone. They are cached per media id and released together.
3. **A missing blob rendering as a mystery.** An evicted file shows its caption plus "no longer in this browser" instead of a broken-image icon.

The real cost of this decision is stated at the point of upload, not buried in a doc: uploaded files do not travel inside the JSON export. Every local item has a download button and the Money view offers to dump them all.
