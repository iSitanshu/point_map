/**
 * Edit this file to configure the app. Nothing here is required to get started —
 * the defaults run on OpenStreetMap with no key, no account and no credit card.
 */

const defaults = {
  /**
   * Paste a Google Maps JavaScript API key here to switch to Google Maps.
   * Leave it empty to stay on OpenStreetMap. See docs/setup-google-maps.md.
   */
  googleMapsApiKey: "",

  /** Advanced markers need a Map ID. DEMO_MAP_ID works for development. */
  googleMapId: "DEMO_MAP_ID",

  /** "auto" → Google when a key exists, OpenStreetMap otherwise. Or pin it: "google" | "osm". */
  mapProvider: "auto",

  /** Where the map opens before any points exist. */
  city: { name: "Mumbai", lat: 19.076, lng: 72.8777, zoom: 11 },

  /** Load example locations the first time the app runs, so it is never empty. */
  loadSeedData: true,
};

/**
 * Keeping your key out of git: create app/config.local.js (already gitignored)
 *
 *   export const overrides = { googleMapsApiKey: "AIza…" };
 *
 * then flip this to true. It is off by default so the browser console stays
 * clean for everyone who never creates that file.
 */
const USE_LOCAL_OVERRIDES = false;

let overrides = {};
if (USE_LOCAL_OVERRIDES) {
  try {
    ({ overrides = {} } = await import("./config.local.js"));
  } catch (err) {
    console.warn("config.local.js not found — using defaults from config.js", err);
  }
}

export const config = { ...defaults, ...overrides };
