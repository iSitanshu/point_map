# T-013 — Voice notes with lazy transcription

**Status:** next · **Priority:** P2 · **Estimate:** M · **Governed by:** ADR-0007

## Why

Standing outside a PG, typing is slow and the things worth recording are impressions — *"stairwell smells, but the room gets morning light and the watchman seemed decent"*. Those are the notes that decide between two options a week later, and they are exactly the notes that never get typed.

## Acceptance criteria

- [ ] Hold-to-record button in the detail drawer using `MediaRecorder`
- [ ] Audio stored as a `local` media item with `slot: "voice"` (ADR-0007 route 3, no new storage mechanism)
- [ ] Playback inline with duration; delete per clip
- [ ] 2-minute cap per clip, 5 clips per point
- [ ] Optional transcription via the Web Speech API when online, stored in `caption`, editable, clearly marked as auto-generated
- [ ] Transcription failure is silent — the audio is the artefact, the text is a convenience
- [ ] Transcribed text is searchable along with notes
- [ ] Mic permission requested on first record only, with a one-line explanation of where the audio is stored

## Files

- `app/ui/detail.js` — record button and clip list
- `app/media.js` — audio blob handling (already generic over blobs)
- `app/ui/voice.js` — new; recorder + transcription wrapper
- `app/store.js` — include captions in the search index

## Notes

`MediaRecorder` output format differs by browser (`audio/webm` on Chrome, `audio/mp4` on Safari). Store the mime type alongside the blob and feed it back to the `<audio>` element rather than assuming.

Web Speech API transcription is Chrome-only in practice and mediocre with Indian place names. It is a bonus, never the feature. No cloud transcription — that would send the user's private impressions to a third party, which this app otherwise never does.
