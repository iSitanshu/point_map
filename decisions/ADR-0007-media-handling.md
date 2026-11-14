# ADR-0007 — Slot-based media across three storage routes

**Status:** Accepted · **Date:** 2026-11-14

## Context

The brief was specific: *"it can store the videos of the area too."* A video walkthrough of the lane outside a PG at night is worth more than any field in the schema — you cannot recall six lanes a week later, but you recognise one instantly.

The constraint is equally specific: there is no server (ADR-0002). Video has to live in the browser or be a link to somewhere else.

## Options considered

### Where the bytes live

| Option | Verdict |
|---|---|
| **Data URIs in localStorage** | Simplest. A ~5 MB quota shared with all the app's data; one phone video blows it and corrupts the save. Rejected. |
| **IndexedDB blobs** | Hundreds of MB available, real `File` objects, works offline. Browsers can evict it (iOS after ~7 days of inactivity) and it does not travel inside a JSON export. Chosen as one route. |
| **External links only** (YouTube unlisted / Drive) | Zero storage cost, durable, shareable, survives a cleared browser. Needs an upload step and a network connection to view. Chosen as one route. |
| **Local files in a `media/` folder** | Free, durable, versionable, no upload. Requires putting a file in a folder by hand — fine on a laptop, impossible from a phone. Chosen as one route. |

No single route covers both "standing outside a PG with a phone" and "want this to survive a browser reset", so all three are supported.

### How media is organised

Rejected: a generic "add photos" gallery. Chosen: **named slots** — `room`, `bathroom`, `kitchen`, `entrance`, `street-night`, `walk-to-station`, `other`. The bathroom and the night-street shots are the ones people forget to take and the ones that decide it, so the UI asks for them by name instead of hoping.

## Decision

A media item is `{ id, slot, type, src, caption, addedAt }` with four `type` values resolved at render:

| `type` | `src` | Rendered as |
|---|---|---|
| `image` | URL or `media/front-gate.jpg` | `<img loading="lazy">` |
| `video` | URL or `media/walkthrough.mp4` | `<video controls preload="none">` |
| `embed` | YouTube / Drive link | `<iframe>`, auto-rewritten to embed form |
| `local` | `idb:<mediaId>` | IndexedDB blob via `URL.createObjectURL` |

Type is inferred from what the user pastes, so there is no type picker to get wrong.

**Limits, enforced quietly:** 10 items per point; images downscaled client-side to 1600px before storing; a warning (not a block) above 30 s of video; total IndexedDB usage shown in Settings.

**Object URLs are cached per media id and revoked when the drawer closes.** Creating one per render leaks memory steadily, which on a phone ends as a crashed tab.

## Consequences

**Accepted — and this is the real cost:** `local` blobs do **not** travel inside the JSON export. Export keeps the reference; the bytes stay in IndexedDB. A laptop → phone migration is therefore two steps. Mitigations: Settings offers **"download all local media"** as a zip-less batch of individual files, every `local` item shows a download button, and the item's caption is retained in the export so a missing blob degrades to a labelled placeholder rather than a mystery. The honest summary is that the convenient route is the least durable one, the UI says so at the point of upload, and links are recommended for anything the user would be upset to lose.

**Also accepted:**
- Three routes means three code paths in the gallery. Contained in one `renderMediaItem()` switch.
- Embeds depend on YouTube/Drive remaining reachable and the link staying unlisted-but-live.
- Client-side image compression uses a canvas round-trip, which strips EXIF — including orientation. Orientation is normalised explicitly before drawing; this was a bug worth noting rather than rediscovering.

**Gained:**
- A video of the lane at 9pm is attachable from a phone, in the moment, with no upload and no account.
- Slots turn the gallery into a checklist, which makes the *useful* photos get taken.

## Revisit if

IndexedDB eviction actually bites once, or the user asks to share media with a parent — both point at a cheap object store (or a Drive folder) as the canonical home, with IndexedDB demoted to a cache.
