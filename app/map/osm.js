/**
 * OpenStreetMap provider — Leaflet + raster OSM tiles.
 *
 * The default, because it needs no key, no account and no credit card, so the
 * app works on first run (ADR-0001). Leaflet rather than MapLibre specifically
 * because raster OSM tiles need no style host and no provider key either.
 */

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

let loadPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      document.head.appendChild(Object.assign(document.createElement("link"), {
        rel: "stylesheet",
        href: LEAFLET_CSS,
        crossOrigin: "",
      }));
    }
    const script = Object.assign(document.createElement("script"), {
      src: LEAFLET_JS,
      async: true,
      crossOrigin: "",
      onload: () => resolve(window.L),
      onerror: () => reject(new Error("Could not load Leaflet — are you offline?")),
    });
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function createOSMProvider({ container, center, zoom, onMapClick, onViewportChange }) {
  const L = await loadLeaflet();

  const map = L.map(container, {
    center: [center.lat, center.lng],
    zoom,
    zoomControl: false,
    attributionControl: true,
    worldCopyJump: true,
    tap: false, // Leaflet's synthetic tap double-fires clicks on some phones
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);

  if (onMapClick) {
    map.on("click", (event) => onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }));
  }
  if (onViewportChange) {
    map.on("moveend", onViewportChange);
    map.on("zoomend", onViewportChange);
  }

  return {
    name: "osm",
    label: "OpenStreetMap",

    setMarkers(renderables) {
      markerLayer.clearLayers();
      for (const item of renderables) {
        const icon = L.divIcon({
          // A zero-size icon: the shared .pin CSS does the positioning, so the
          // same markup anchors identically under both providers.
          html: item.element,
          className: "pin-wrap",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const marker = L.marker([item.lat, item.lng], {
          icon,
          zIndexOffset: item.zIndex ?? 0,
          keyboard: false,
          interactive: Boolean(item.onClick),
        });
        if (item.onClick) {
          marker.on("click", (event) => {
            L.DomEvent.stopPropagation(event);
            item.onClick();
          });
        }
        marker.addTo(markerLayer);
      }
    },

    getZoom: () => map.getZoom(),

    getBounds() {
      const bounds = map.getBounds();
      return {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };
    },

    setView(lat, lng, nextZoom) {
      map.setView([lat, lng], nextZoom ?? map.getZoom(), { animate: true });
    },

    fitBounds(bounds) {
      map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], {
        padding: [56, 56],
        maxZoom: 15,
      });
    },

    invalidateSize: () => map.invalidateSize(),
    destroy: () => map.remove(),
    raw: map,
  };
}
