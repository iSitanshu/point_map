# media/

Drop your own photos and videos here, then reference them from a location by filename:

```
media/sai-pg-room.jpg
media/chakala-lane-night.mp4
```

In the app: open a location → **Media** → paste `media/sai-pg-room.jpg` as the source, pick a slot (room / bathroom / kitchen / entrance / street at night / walk to station).

Three ways to attach media, and the trade-off between them:

| Route | Durable? | Works from a phone? |
|---|---|---|
| **This folder** | Yes — it is a real file on disk | No, you need the filesystem |
| **A link** (YouTube unlisted, Drive, any URL) | Yes, as long as the link lives | Yes |
| **Upload in the app** | No — stored in the browser, can be evicted | Yes, easiest |

For anything you would be upset to lose, use this folder or a link. See `decisions/ADR-0007-media-handling.md`.

The contents of this folder are gitignored — your photos stay yours.
