/**
 * Google Maps provider.
 *
 * Used automatically as soon as `config.googleMapsApiKey` is set (ADR-0001).
 * Uses AdvancedMarkerElement so the marker content is a real DOM element —
 * which is what lets both providers share one marker renderer.
 */

let loadPromise = null;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "__pointMapGoogleReady";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google);
    };

    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      libraries: "marker",
      loading: "async",
      callback: callbackName,
    });

    const script = Object.assign(document.createElement("script"), {
      src: `https://maps.googleapis.com/maps/api/js?${params}`,
      async: true,
      onerror: () => reject(new Error("Google Maps failed to load — check the key and its website restrictions")),
    });
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function createGoogleProvider({
  container, center, zoom, onMapClick, onViewportChange, apiKey, mapId,
}) {
  if (!apiKey) throw new Error("No Google Maps API key configured");

  await loadGoogleMaps(apiKey);
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  const map = new Map(container, {
    center,
    zoom,
    mapId: mapId || "DEMO_MAP_ID",
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false, // the user's own pins are the only clickable things
    gestureHandling: "greedy",
  });

  if (onMapClick) {
    map.addListener("click", (event) => {
      if (!event.latLng) return;
      onMapClick({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    });
  }
  if (onViewportChange) map.addListener("idle", onViewportChange);

  let markers = [];

  return {
    name: "google",
    label: "Google Maps",

    setMarkers(renderables) {
      for (const marker of markers) marker.map = null;
      markers = renderables.map((item) => {
        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: item.lat, lng: item.lng },
          content: item.element,
          zIndex: item.zIndex ?? 0,
          gmpClickable: Boolean(item.onClick),
          title: item.element?.title || "",
        });
        if (item.onClick) {
          marker.addListener("click", () => item.onClick());
        }
        return marker;
      });
    },

    getZoom: () => map.getZoom(),

    getBounds() {
      const bounds = map.getBounds();
      if (!bounds) return null;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      return { north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() };
    },

    setView(lat, lng, nextZoom) {
      map.panTo({ lat, lng });
      if (nextZoom) map.setZoom(nextZoom);
    },

    fitBounds(bounds) {
      map.fitBounds(
        new google.maps.LatLngBounds(
          { lat: bounds.south, lng: bounds.west },
          { lat: bounds.north, lng: bounds.east },
        ),
        56,
      );
    },

    invalidateSize: () => google.maps.event.trigger(map, "resize"),

    destroy() {
      for (const marker of markers) marker.map = null;
      markers = [];
      container.replaceChildren();
    },

    raw: map,
  };
}
