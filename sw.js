/**
 * Service worker — makes the app installable and usable with no signal.
 *
 * That matters for one specific moment: standing outside a PG on one bar of
 * network, taking a photo of the bathroom and ticking the checklist. The data
 * layer was always offline (localStorage), but without this the *page* might
 * not load at all and the map would be blank.
 *
 * Three caches, three policies:
 *   shell  — app code. Cache-first, revalidated in the background.
 *   tiles  — map tiles. Cache-first, capped, never bulk-prefetched.
 *   vendor — Leaflet from unpkg. Cache-first; it is version-pinned.
 *
 * Bump VERSION when app files change — with no bundler there is no content
 * hashing, so this string is what tells browsers the shell is stale.
 * (ADR-0003 names this as the cost of having no build step.)
 */

const VERSION = "v2";
const SHELL_CACHE = `point-map-shell-${VERSION}`;
const TILE_CACHE = "point-map-tiles";
const VENDOR_CACHE = "point-map-vendor";

/** Capped so a few weeks of panning cannot fill the device. ~300 tiles ≈ 6 MB. */
const MAX_TILES = 300;

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "app/main.js",
  "app/config.js",
  "app/model.js",
  "app/store.js",
  "app/media.js",
  "app/lib/util.js",
  "app/lib/money.js",
  "app/lib/parse-whatsapp.js",
  "app/map/index.js",
  "app/map/osm.js",
  "app/map/google.js",
  "app/map/marker-view.js",
  "app/ui/list.js",
  "app/ui/detail.js",
  "app/ui/form.js",
  "app/ui/fields.js",
  "app/ui/compare.js",
  "app/ui/money.js",
  "app/ui/media-panel.js",
  "app/ui/ledger-panel.js",
  "app/ui/toast.js",
  "app/ui/map-controls.js",
  "app/lib/geo.js",
  "app/data/seed.js",
  "app/styles/base.css",
  "app/styles/components.css",
  "app/icons/icon-192.png",
  "app/icons/icon-512.png",
  "app/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll fails the whole install if any single file 404s, which would be a
    // silent, permanent breakage — so each file is added independently.
    await Promise.all(SHELL.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
      } catch (err) {
        console.warn("[sw] could not precache", url, err);
      }
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith("point-map-shell-") && name !== SHELL_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

/** The page asks for this once the user accepts an update. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_TILES) return;
  // Oldest-first: Cache Storage returns keys in insertion order.
  await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName, { trim = false } = {}) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (trim) trimTileCache();
  }
  return response;
}

/** Serve from cache immediately, refresh in the background for next time. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return hit || (await network) || new Response("Offline and not cached", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Google Maps is dynamic and session-bound — caching it would break it.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) return;

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirst(request, TILE_CACHE, { trim: true }).catch(
      () => new Response("", { status: 504 }),
    ));
    return;
  }

  if (url.hostname === "unpkg.com") {
    event.respondWith(cacheFirst(request, VENDOR_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // A navigation that cannot be served still has to land somewhere useful.
  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match("index.html")) || (await cache.match("./"));
    }));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
