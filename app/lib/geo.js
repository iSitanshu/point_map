/**
 * Location services: where you are, where an area is, and where the stations
 * are. All three use free, key-free sources so nothing here needs an account.
 *
 *   getCurrentPosition()  — the browser's GPS, with readable errors
 *   searchArea()          — a locality name → coordinates (Nominatim, cached)
 *   loadStations()        — Mumbai rail + metro stations (OpenStreetMap, cached)
 *
 * Every network result is cached in localStorage, so the second use is instant
 * and the app keeps working offline once it has been online.
 */

/** Greater Mumbai, used to bias searches and bound the station query. */
export const MUMBAI_BBOX = { south: 18.85, west: 72.75, north: 19.50, east: 73.12 };

export const MUMBAI_CENTER = { lat: 19.076, lng: 72.8777 };

/**
 * Suggestions only — names, never coordinates. Coordinates always come from
 * OpenStreetMap so nothing here is a number someone typed from memory.
 */
export const MMR_LOCALITIES = [
  "Andheri East", "Andheri West", "Bandra East", "Bandra West", "Bhandup", "Borivali",
  "Byculla", "Chakala", "Chembur", "Churchgate", "Colaba", "Dadar", "Dahisar",
  "Ghatkopar", "Goregaon East", "Goregaon West", "Jogeshwari", "Juhu", "Kandivali",
  "Kanjurmarg", "Khar", "Kurla", "Lower Parel", "Malad East", "Malad West", "Marol",
  "Matunga", "Mira Road", "Mulund", "Nahur", "Navi Mumbai", "Nerul", "Parel", "Powai",
  "Prabhadevi", "Saki Naka", "Santacruz East", "Santacruz West", "Sion", "Thane",
  "Vashi", "Versova", "Vikhroli", "Vile Parle East", "Vile Parle West", "Wadala",
  "Worli", "Bandra Kurla Complex", "Seawoods", "Airoli", "Ghansoli", "Dombivli",
];

/* ------------------------------------------------------------ your location -- */

/**
 * The browser's geolocation, wrapped so failures say something a person can act
 * on. Must be triggered by a tap — browsers reject silent background requests.
 */
export function getCurrentPosition({ timeout = 12000, highAccuracy = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser can't do location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const messages = {
          1: "Location permission was denied. Allow it in your browser's site settings — tap the padlock in the address bar.",
          2: "Couldn't get a fix. Try again near a window, or with wifi on.",
          3: "Location timed out. Try again.",
        };
        reject(new Error(messages[error.code] || "Couldn't get your location."));
      },
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: 60_000 },
    );
  });
}

/* ------------------------------------------------------------- area search -- */

const AREA_CACHE_KEY = "point_map.areas.v1";

const readCache = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota — caching is an optimisation, never a requirement */ }
};

/**
 * Look up an area by name. Results are cached permanently per query, because a
 * locality does not move and Nominatim asks to be used sparingly.
 */
export async function searchArea(query) {
  const term = String(query || "").trim();
  if (term.length < 2) return [];

  const cacheKey = term.toLowerCase();
  const cache = readCache(AREA_CACHE_KEY);
  if (cache[cacheKey]) return cache[cacheKey];

  const params = new URLSearchParams({
    format: "jsonv2",
    q: /mumbai|thane|navi/i.test(term) ? term : `${term}, Mumbai`,
    countrycodes: "in",
    limit: "6",
    viewbox: `${MUMBAI_BBOX.west},${MUMBAI_BBOX.north},${MUMBAI_BBOX.east},${MUMBAI_BBOX.south}`,
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Area search is unavailable right now.");

  const results = (await response.json()).map((row) => ({
    label: shortenLabel(row.display_name),
    full: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
  })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));

  cache[cacheKey] = results;
  writeCache(AREA_CACHE_KEY, cache);
  return results;
}

/** "Andheri East, Mumbai Suburban, Maharashtra, 400069, India" → first three parts. */
const shortenLabel = (displayName) =>
  String(displayName).split(",").slice(0, 3).map((part) => part.trim()).join(", ");

/* ---------------------------------------------------------------- stations -- */

const STATION_CACHE_KEY = "point_map.stations.v1";
const STATION_MAX_AGE_DAYS = 60;

/**
 * Mumbai's rail and metro stations, from OpenStreetMap via Overpass.
 *
 * Fetched from the map data rather than typed out, so no coordinate here is a
 * guess. Cached for two months; a failure is silent because stations are a
 * helpful backdrop, not something the app depends on.
 */
export async function loadStations({ force = false } = {}) {
  const cached = readCache(STATION_CACHE_KEY);
  const ageDays = cached.fetchedAt
    ? (Date.now() - new Date(cached.fetchedAt).getTime()) / 86_400_000
    : Infinity;

  if (!force && Array.isArray(cached.stations) && ageDays < STATION_MAX_AGE_DAYS) {
    return cached.stations;
  }

  const { south, west, north, east } = MUMBAI_BBOX;
  const query = `
    [out:json][timeout:25];
    (
      node["railway"="station"](${south},${west},${north},${east});
      node["railway"="halt"](${south},${west},${north},${east});
    );
    out body;`;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);

    const data = await response.json();
    const stations = (data.elements || [])
      .filter((node) => node.lat && node.lon && node.tags?.name)
      .map((node) => ({
        id: `st_${node.id}`,
        name: node.tags.name.replace(/\s+(Railway Station|Metro Station)$/i, ""),
        lat: node.lat,
        lng: node.lon,
        metro: node.tags.station === "subway"
          || node.tags.subway === "yes"
          || /metro/i.test(node.tags.name)
          || /metro/i.test(node.tags.network || ""),
      }))
      // Overpass returns both the platform node and the station node for some
      // stops; one pin per name is what is actually useful on screen.
      .filter((station, index, all) => all.findIndex((s) => s.name === station.name) === index);

    writeCache(STATION_CACHE_KEY, { fetchedAt: new Date().toISOString(), stations });
    return stations;
  } catch (err) {
    console.warn("Station data unavailable", err);
    return Array.isArray(cached.stations) ? cached.stations : [];
  }
}

/** Nearest station to a point, for the "walk to station" hint. */
export function nearestStation(point, stations) {
  if (!point || !stations?.length) return null;
  let best = null;
  for (const station of stations) {
    const dLat = station.lat - point.lat;
    const dLng = station.lng - point.lng;
    const roughKm = Math.hypot(dLat, dLng * 0.94) * 111;
    if (!best || roughKm < best.km) best = { station, km: Math.round(roughKm * 10) / 10 };
  }
  return best;
}
