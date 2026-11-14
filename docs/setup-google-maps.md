# Switching to Google Maps

The app runs out of the box on OpenStreetMap, which needs no key, no account and no credit card. Google Maps gives you nicer India data, Street View context and familiar styling — but it requires a billing-enabled Google Cloud project.

You do not need this to use the app. Do it when the free map starts annoying you.

---

## 1. Get a key

1. Go to <https://console.cloud.google.com/> and sign in.
2. Create a project (top-left project picker → **New project**). Call it `point-map`.
3. **Billing** → link a payment method. Google asks for a card even though the free tier is generous; map loads for personal use will not realistically cost you anything, but set a budget alert in step 5 anyway.
4. **APIs & Services → Library** → enable:
   - **Maps JavaScript API** (required)
   - *Places API* (only if you later want address autocomplete)
   - *Geocoding API* (only if you want address → coordinates lookup)
5. **APIs & Services → Credentials → Create credentials → API key.** Copy it.

## 2. Lock the key down — do this now, not later

An unrestricted key pasted into a web page can be used by anyone who views the page.

On the key's settings screen:

- **Application restrictions → Websites.** Add:
  - `http://localhost:8080/*`
  - `http://127.0.0.1:8080/*`
  - plus your real domain if you ever host it
- **API restrictions → Restrict key** → select only the APIs you enabled above.
- **Billing → Budgets & alerts** → create a budget of, say, ₹500 with an email alert at 50%. Cheap insurance against a mistake.

## 3. Put it in the app

Open `app/config.js`:

```js
export const config = {
  googleMapsApiKey: "AIza…your key here…",
  googleMapId: "DEMO_MAP_ID",
  mapProvider: "auto",   // auto → Google when a key exists, else OpenStreetMap
  …
};
```

Reload the page. The badge in the top bar should read **Google**. If it still says **OSM**, open the browser console — a bad key logs a clear error there.

### Optional: a styled map

`DEMO_MAP_ID` works for development but shows a watermark. For your own style:
**Google Cloud → Google Maps Platform → Map Styles → Create style**, pick a theme, then copy the generated **Map ID** into `googleMapId`.

## 4. Keeping the key out of git

`.gitignore` already excludes `app/config.local.js`. If you push this repo publicly, move the key there:

```js
// app/config.local.js  (ignored by git)
export const overrides = { googleMapsApiKey: "AIza…" };
```

`config.js` picks that file up automatically when it exists and falls back silently when it doesn't.

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| Grey map, console says `RefererNotAllowedMapError` | The URL you're on isn't in the websites allowlist. Add `http://localhost:8080/*`. |
| `ApiNotActivatedMapError` | Maps JavaScript API not enabled for the project. |
| `BillingNotEnabledMapError` | No payment method linked. |
| Map loads with a dark "for development purposes only" overlay | Billing not enabled, or you exceeded the free tier. |
| Pins render but look like plain markers | `googleMapId` is missing — advanced markers need a Map ID. |

Switching back is one line: set `mapProvider: "osm"`.
