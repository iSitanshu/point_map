/**
 * The map controller: one interface over two providers.
 *
 * It owns every decision about *what* to draw — zoom tier, clustering, the pill
 * cap, dimming, the work pin — and hands the provider a flat list of
 * {lat, lng, element, zIndex, onClick}. The providers stay thin enough that
 * supporting both is affordable (ADR-0001), and the readability rules live in
 * one place (ADR-0004).
 */

import { config } from "../config.js";
import { createOSMProvider } from "./osm.js";
import { createGoogleProvider } from "./google.js";
import {
  TIERS, tierForZoom, buildClusters, renderPin, renderCluster, renderWorkPin,
  renderStation, renderMyLocation, spreadOverlaps,
} from "./marker-view.js";
import { hasLocation, isStale } from "../model.js";
import { debounce } from "../lib/util.js";

const withinBounds = (point, bounds) => (
  point.lat <= bounds.north && point.lat >= bounds.south
  && point.lng <= bounds.east && point.lng >= bounds.west
);

export async function createMapController({
  container,
  settings = {},
  initialView = null,
  onSelect,
  onMapClick,
  onViewportChange,
  onStatus,
}) {
  const wanted = settings.mapProvider || config.mapProvider || "auto";
  const tryGoogle = wanted === "google"
    || (wanted === "auto" && Boolean(config.googleMapsApiKey));

  let currentSettings = settings;
  let currentPoints = [];
  let currentStations = [];
  let myLocation = null;
  let selectedId = null;

  /* The viewport handler is installed before the provider exists, so it has to
     tolerate being called during construction. */
  const handleViewport = debounce(() => {
    draw();
    onViewportChange?.();
  }, 120);

  const initOptions = {
    container,
    center: initialView
      ? { lat: initialView.lat, lng: initialView.lng }
      : { lat: config.city.lat, lng: config.city.lng },
    zoom: initialView?.zoom ?? config.city.zoom,
    onMapClick,
    onViewportChange: handleViewport,
  };

  let provider;
  let providerNote = null;

  if (tryGoogle) {
    try {
      provider = await createGoogleProvider({
        ...initOptions,
        apiKey: config.googleMapsApiKey,
        mapId: config.googleMapId,
      });
    } catch (err) {
      // A bad key, unbilled project or blocked referrer must not leave the user
      // staring at a grey rectangle — fall back and say why.
      console.warn("Google Maps unavailable, falling back to OpenStreetMap", err);
      providerNote = `Google Maps didn't load (${err.message}). Using OpenStreetMap.`;
      container.replaceChildren();
      provider = await createOSMProvider(initOptions);
    }
  } else {
    provider = await createOSMProvider(initOptions);
  }

  /* ------------------------------------------------------------------ draw -- */

  function draw() {
    if (!provider) return;

    const points = currentPoints.filter(hasLocation);
    const zoom = provider.getZoom() ?? config.city.zoom;
    const bounds = provider.getBounds();
    const inView = bounds ? points.filter((point) => withinBounds(point, bounds)) : points;

    let tier = tierForZoom(zoom);

    // The cap that stops forty markers becoming soup: too many pills in view,
    // and they all degrade to dots until the user zooms in.
    const cap = currentSettings.pillCap ?? 25;
    const capped = tier !== TIERS.CLUSTER && inView.length > cap;
    if (capped) tier = TIERS.CLUSTER;

    const renderables = [];
    const dim = (point) => Boolean(selectedId) && point.id !== selectedId;

    const pinFor = (point, pinTier) => ({
      key: point.id,
      lat: point.lat,
      lng: point.lng,
      element: renderPin(point, {
        tier: pinTier,
        selected: point.id === selectedId,
        dimmed: dim(point),
        settings: currentSettings,
      }),
      zIndex: point.id === selectedId ? 1000 : isStale(point, currentSettings) ? 10 : 100,
      onClick: () => onSelect?.(point.id),
    });

    if (tier === TIERS.CLUSTER) {
      for (const cluster of buildClusters(points, zoom)) {
        // A lone pin is never hidden inside a bubble — the cheapest option must
        // stay readable at every zoom.
        if (cluster.points.length === 1) {
          renderables.push(pinFor(cluster.points[0], TIERS.CLUSTER));
          continue;
        }
        renderables.push({
          key: `cluster:${cluster.key}`,
          lat: cluster.lat,
          lng: cluster.lng,
          element: renderCluster(cluster, { settings: currentSettings }),
          zIndex: 50,
          onClick: () => zoomToCluster(cluster),
        });
      }
    } else {
      const spread = spreadOverlaps(points.map((point) => ({ lat: point.lat, lng: point.lng, point })));
      for (const item of spread) {
        renderables.push({ ...pinFor(item.point, tier), lat: item.lat, lng: item.lng });
      }
    }

    // Stations sit underneath everything: context, not content. Below zoom 12
    // they would be unreadable clutter over a whole city.
    if (currentSettings.showStations !== false && zoom >= 12 && currentStations.length) {
      for (const station of currentStations) {
        if (bounds && !withinBounds(station, bounds)) continue;
        renderables.push({
          key: station.id,
          lat: station.lat,
          lng: station.lng,
          element: renderStation(station, { zoom }),
          zIndex: 1,
        });
      }
    }

    if (myLocation) {
      renderables.push({
        key: "my-location",
        lat: myLocation.lat,
        lng: myLocation.lng,
        element: renderMyLocation(),
        zIndex: 30,
      });
    }

    if (currentSettings.workPin) {
      renderables.push({
        key: "work-pin",
        lat: currentSettings.workPin.lat,
        lng: currentSettings.workPin.lng,
        element: renderWorkPin(currentSettings.workPin.label || "Work"),
        zIndex: 20,
      });
    }

    provider.setMarkers(renderables);

    onStatus?.({
      provider: provider.name,
      providerLabel: provider.label,
      zoom,
      tier,
      capped,
      shown: renderables.length,
      inView: inView.length,
      total: points.length,
      note: providerNote,
    });
  }

  function zoomToCluster(cluster) {
    const lats = cluster.points.map((point) => point.lat);
    const lngs = cluster.points.map((point) => point.lng);
    const spread = Math.max(...lats) - Math.min(...lats) + Math.max(...lngs) - Math.min(...lngs);

    // Points stacked on the same spot cannot be separated by fitting bounds —
    // step the zoom instead so the click always does something visible.
    if (spread < 0.0005) {
      provider.setView(cluster.lat, cluster.lng, Math.min((provider.getZoom() ?? 11) + 3, 17));
      return;
    }
    provider.fitBounds({
      north: Math.max(...lats), south: Math.min(...lats),
      east: Math.max(...lngs), west: Math.min(...lngs),
    });
  }

  /* -------------------------------------------------------------- interface -- */

  const controller = {
    get providerName() { return provider.name; },
    get providerLabel() { return provider.label; },
    get providerNote() { return providerNote; },

    setStations(stations) {
      currentStations = stations || [];
      draw();
    },

    setMyLocation(location) {
      myLocation = location;
      draw();
    },

    setData(points, options = {}) {
      currentPoints = points || [];
      if ("selectedId" in options) selectedId = options.selectedId;
      if (options.settings) currentSettings = options.settings;
      draw();
    },

    focus(lat, lng, zoom) {
      provider.setView(lat, lng, zoom);
    },

    focusPoint(point, zoom = 16) {
      if (!hasLocation(point)) return;
      provider.setView(point.lat, point.lng, Math.max(provider.getZoom() ?? 0, zoom));
    },

    fitAll(points = currentPoints) {
      const located = points.filter(hasLocation);
      if (!located.length) return;
      if (located.length === 1) {
        provider.setView(located[0].lat, located[0].lng, 15);
        return;
      }
      provider.fitBounds({
        north: Math.max(...located.map((p) => p.lat)),
        south: Math.min(...located.map((p) => p.lat)),
        east: Math.max(...located.map((p) => p.lng)),
        west: Math.min(...located.map((p) => p.lng)),
      });
    },

    getZoom: () => provider.getZoom(),
    getBounds: () => provider.getBounds(),
    idsInView() {
      const bounds = provider.getBounds();
      if (!bounds) return null;
      return currentPoints.filter((point) => hasLocation(point) && withinBounds(point, bounds))
        .map((point) => point.id);
    },
    invalidateSize: () => provider.invalidateSize?.(),
    redraw: draw,
    destroy: () => provider.destroy(),
  };

  draw();
  return controller;
}
