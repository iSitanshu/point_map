# Using point map on your phone

The app is published from this repo, so your laptop does not need to be on.

**→ https://isitanshu.github.io/point_map/**

Every push to `main` runs the tests and redeploys that URL automatically.

---

## One-time switch to turn the URL on

GitHub will not let a workflow create a Pages site by itself — it returns
*"Resource not accessible by integration"* — so this has to be done once, by hand:

1. Open **https://github.com/iSitanshu/point_map/settings/pages**
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab, open the latest *"Test and deploy to GitHub Pages"* run, and press **Re-run jobs**.

Takes about ten seconds. After that every push deploys on its own and you never touch it again. The first deploy takes a minute or two to appear.

## Install it to your home screen

Once installed it opens full-screen, with no browser chrome, and works with no signal.

**Android / Chrome**
1. Open the link above.
2. Tap **⤓ Install** in the top bar — or Chrome's menu → *Install app*.
3. It appears on your home screen like any other app.

**iPhone / Safari** — iOS has no install button; Apple requires the manual route:
1. Open the link in **Safari** (not Chrome — only Safari can install on iOS).
2. Tap the **Share** button.
3. Scroll down → **Add to Home Screen** → Add.

## What works with no signal

Everything except fresh map tiles:

| | Offline |
|---|---|
| Your locations, notes, costs, ledger | ✅ Fully |
| Adding and editing a place | ✅ Fully |
| Compare and Money views | ✅ Fully |
| Photos and videos you uploaded | ✅ Fully |
| Map tiles you've already looked at | ✅ Cached (about 300 of them) |
| Map tiles for an area you've never opened | ❌ Grey until you're back online |
| Photos and videos stored as links | ❌ Need the network |

A tip for a viewing trip: before you leave, open the map and zoom around the area you're visiting. Those tiles are then cached and the map works when you get there.

## The one thing to know: your phone and laptop are separate

Your data lives in **each device's own browser storage**. Nothing is on a server — which is why there is no account, no password and no monthly cost, and why nobody else can read your notes even though the app itself is a public URL.

The trade-off is that your phone and laptop do not sync automatically.

**To move data between them:**

1. On the device that has the research: **Money → Your data → ⤓ Back up to a JSON file**
2. Send the file to the other device (email, WhatsApp to yourself, AirDrop, Drive).
3. On the other device: **Money → Your data → ⤒ Import a backup**.

**Import replaces everything**, so always export from the device you are importing *into* first if it has anything worth keeping.

Realistically: pick one device as the main one. Use the phone for capture during visits, export at the end of the day, import on the laptop when comparing properly.

Real sync is [`tasks/later/T-015-cloud-sync.md`](../tasks/later/T-015-cloud-sync.md) — a single row in a free Postgres, no login. Now that both devices are in use, it is the next thing worth building.

## Uploaded photos and videos don't travel in the backup

Files you upload in the app are stored in that browser's own storage and are **not** inside the JSON backup file.

- To keep them: **Money → Your data → ⤓ Download uploaded media**, then re-attach on the other device.
- To avoid the problem entirely: for anything important, upload to Google Drive or YouTube (unlisted) and paste the **link** instead. Links travel in the backup and survive a cleared browser.

Full reasoning: [`decisions/ADR-0007`](../decisions/ADR-0007-media-handling.md).

## Backups

Everything is in your browser, and browsers can clear storage — iOS in particular evicts data from sites you haven't opened in a while.

The app nags you about this: the top bar shows how long since your last backup and turns amber after a week. Take it seriously, especially on a phone. `⌘/Ctrl + S` on a laptop does it in one keystroke.

## Updating

When a new version is deployed, the app shows *"A new version is ready"* with a Reload button the next time you open it. Nothing updates underneath you mid-use.

## If the link doesn't work yet

GitHub Pages takes a minute or two after the first deploy, and the workflow enables it automatically on the first run.

Check **Actions** in the repo for a green tick on *"Test and deploy to GitHub Pages"*. If Pages was never enabled and the automatic step was blocked, turn it on manually: **Settings → Pages → Source: GitHub Actions**, then re-run the workflow.

## Running it on your laptop without the internet

The published URL is the easy path, but the local copy still works:

```bash
cd point_map
./start.sh
# http://localhost:8080
```
