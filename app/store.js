/**
 * All application state, persistence, filtering and import/export.
 *
 * Every mutation writes to localStorage synchronously (ADR-0002) — there is no
 * save button, no dirty state and no partial-write failure mode to design for.
 *
 * Persisted:     { version, settings, points }
 * Not persisted: selection, search text, filters, which view is open.
 *                Session UI state resetting on reload is predictable; a stale
 *                filter silently hiding half the data is not.
 */

import { config } from "./config.js";
import {
  DEFAULT_SETTINGS, newPoint, newLedgerEntry, pointSearchText, isStale,
  hasLocation, completeness,
} from "./model.js";
import { tmcSortValue, cashDayOne, netCostOfStay, distanceFromWork, adjustedTMC } from "./lib/money.js";
import { uid, num, nowISO, todayISO, download, toCSV, haversineKm } from "./lib/util.js";
import { SEED_POINTS, SEED_SETTINGS } from "./data/seed.js";

const STORAGE_KEY = "point_map.v1";
const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ state -- */

const state = {
  points: [],
  settings: { ...DEFAULT_SETTINGS },

  // session-only
  view: "map",
  selectedId: null,
  editingId: null,
  compareIds: [],
  search: "",
  sort: "tmc",
  filters: {
    limitToArea: true,
    statuses: [],
    kinds: [],
    maxTMC: null,
    gender: "",
    foodIncluded: null,
    maxSharing: null,
    tags: [],
    maxKmFromWork: null,
  },
};

const listeners = new Set();

export const getState = () => state;
export const getSettings = () => state.settings;
export const getPoints = () => state.points;
export const pointById = (id) => state.points.find((point) => point.id === id) || null;
export const selectedPoint = () => pointById(state.selectedId);

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(reason = "change") {
  for (const listener of listeners) listener(state, reason);
}

/* ------------------------------------------------------------ persistence -- */

/**
 * Fill in anything a stored, imported or seeded point is missing, so the rest
 * of the app can read `point.costs.utilitiesBreakdown.water` without guarding
 * every level. Adding an optional field to the schema needs no migration —
 * this merge backfills it on next load.
 */
export function normalizePoint(raw = {}) {
  const base = newPoint();
  const merged = { ...base, ...raw };

  for (const key of ["contact", "room", "food", "costs", "rules", "ratings", "commute", "visit"]) {
    merged[key] = { ...base[key], ...(raw[key] || {}) };
  }
  merged.costs.utilitiesBreakdown = {
    ...base.costs.utilitiesBreakdown,
    ...(raw.costs?.utilitiesBreakdown || {}),
  };
  merged.visit.checklist = { ...(raw.visit?.checklist || {}) };

  for (const key of ["amenities", "tags", "links", "media", "ledger"]) {
    merged[key] = Array.isArray(raw[key]) ? raw[key] : [];
  }

  merged.id = raw.id || uid("pt");
  merged.lat = num(raw.lat);
  merged.lng = num(raw.lng);
  return merged;
}

function migrate(doc) {
  const version = num(doc?.version) ?? 0;
  const next = { ...doc };

  // v0 → v1: the first released shape. Future steps append here in order.
  if (version < 1) next.version = 1;

  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(next.settings || {}) },
    points: (next.points || []).map(normalizePoint),
  };
}

export function load() {
  let doc = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) doc = JSON.parse(raw);
  } catch (err) {
    console.error("Could not read saved data — starting fresh. Your export file is the fallback.", err);
  }

  if (doc) {
    const migrated = migrate(doc);
    state.points = migrated.points;
    state.settings = migrated.settings;
  } else if (config.loadSeedData) {
    state.points = SEED_POINTS.map(normalizePoint);
    state.settings = { ...DEFAULT_SETTINGS, ...SEED_SETTINGS };
    save();
  }

  if (!state.settings.mapProvider) state.settings.mapProvider = config.mapProvider;
  notify("load");
  return state;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      settings: state.settings,
      points: state.points,
    }));
    return true;
  } catch (err) {
    // Almost always a full quota — and the user must hear about it immediately,
    // because every edit from here on is being silently dropped.
    console.error("Save failed", err);
    notify("save-error");
    return false;
  }
}

/* --------------------------------------------------------------- mutations -- */

/** Mutate persisted data: saves, counts the write against the backup nag, notifies. */
function commit(mutator, reason = "change") {
  mutator();
  state.settings.writesSinceBackup = (num(state.settings.writesSinceBackup) ?? 0) + 1;
  save();
  notify(reason);
}

/**
 * Remember where the map was, without counting it as a change.
 * Panning is not editing, and it must not trigger the backup nag or a repaint.
 */
export function rememberView(view) {
  state.settings.lastView = view;
  save();
}

export function setSearchArea(area) {
  commit(() => {
    state.settings.searchArea = area;
    state.filters.limitToArea = true;
  }, "area");
}

/** Change session-only UI state: notifies without touching storage. */
export function setUI(patch, reason = "ui") {
  Object.assign(state, patch);
  notify(reason);
}

export function setFilters(patch) {
  state.filters = { ...state.filters, ...patch };
  notify("ui");
}

export function resetFilters() {
  state.filters = {
    limitToArea: true,
    statuses: [], kinds: [], maxTMC: null, gender: "",
    foodIncluded: null, maxSharing: null, tags: [], maxKmFromWork: null,
  };
  state.search = "";
  notify("ui");
}

export function addPoint(partial = {}) {
  const point = normalizePoint(newPoint(partial));
  commit(() => state.points.push(point), "add");
  return point;
}

export function updatePoint(id, patchOrFn) {
  const point = pointById(id);
  if (!point) return null;
  commit(() => {
    const patch = typeof patchOrFn === "function" ? patchOrFn(point) : patchOrFn;
    Object.assign(point, patch || {});
    point.updatedAt = nowISO();
  }, "update");
  return point;
}

/** Field-level write used by inline editing and the generated form. */
export function setPointField(id, path, value) {
  const point = pointById(id);
  if (!point) return null;
  commit(() => {
    const keys = String(path).split(".");
    const last = keys.pop();
    let target = point;
    for (const key of keys) {
      if (typeof target[key] !== "object" || target[key] === null) target[key] = {};
      target = target[key];
    }
    target[last] = value;
    point.updatedAt = nowISO();
    if (path !== "lastVerifiedAt") point.lastVerifiedAt = todayISO();
  }, "update");
  return point;
}

export function removePoint(id) {
  commit(() => {
    state.points = state.points.filter((point) => point.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    state.compareIds = state.compareIds.filter((cid) => cid !== id);
  }, "remove");
}

/** How many of the first-run examples are still around. */
export const demoCount = () => state.points.filter((point) => point.demo).length;

/** Clear only the examples, leaving anything you added untouched. */
export function clearDemoData() {
  commit(() => {
    state.points = state.points.filter((point) => !point.demo);
    state.selectedId = null;
    state.compareIds = state.compareIds.filter((id) => pointById(id));
  }, "remove");
}

export function updateSettings(patch) {
  commit(() => Object.assign(state.settings, patch), "settings");
}

/* ------------------------------------------------------------------ ledger -- */

export function addLedgerEntry(pointId, partial = {}) {
  const point = pointById(pointId);
  if (!point) return null;
  const entry = newLedgerEntry(partial);
  commit(() => point.ledger.push(entry), "ledger");
  return entry;
}

export function addLedgerEntries(pointId, entries = []) {
  const point = pointById(pointId);
  if (!point) return;
  commit(() => {
    for (const entry of entries) point.ledger.push(newLedgerEntry(entry));
  }, "ledger");
}

export function updateLedgerEntry(pointId, entryId, patch) {
  const point = pointById(pointId);
  const entry = point?.ledger.find((row) => row.id === entryId);
  if (!entry) return;
  commit(() => Object.assign(entry, patch), "ledger");
}

export function removeLedgerEntry(pointId, entryId) {
  const point = pointById(pointId);
  if (!point) return;
  commit(() => {
    point.ledger = point.ledger.filter((row) => row.id !== entryId);
  }, "ledger");
}

/* ------------------------------------------------------------------- media -- */

export function addMedia(pointId, item) {
  const point = pointById(pointId);
  if (!point) return;
  commit(() => point.media.push(item), "media");
}

export function updateMedia(pointId, mediaId, patch) {
  const point = pointById(pointId);
  const item = point?.media.find((m) => m.id === mediaId);
  if (!item) return;
  commit(() => Object.assign(item, patch), "media");
}

export function removeMedia(pointId, mediaId) {
  const point = pointById(pointId);
  if (!point) return;
  commit(() => {
    point.media = point.media.filter((m) => m.id !== mediaId);
  }, "media");
}

/* --------------------------------------------------------------- selection -- */

export const select = (id) => setUI({ selectedId: id }, "select");

export function toggleCompare(id) {
  const next = state.compareIds.includes(id)
    ? state.compareIds.filter((cid) => cid !== id)
    : [...state.compareIds, id].slice(-4); // four columns is all that stays readable
  setUI({ compareIds: next }, "compare");
}

export const comparePoints = () =>
  state.compareIds.map(pointById).filter(Boolean);

/* ---------------------------------------------------------------- querying -- */

export const SORTS = [
  { value: "tmc", label: "True monthly cost" },
  { value: "rent", label: "Rent" },
  { value: "cash", label: "Day-one cash" },
  { value: "distance", label: "Distance from work" },
  { value: "verified", label: "Least recently verified" },
  { value: "updated", label: "Recently updated" },
  { value: "completeness", label: "Most complete" },
  { value: "name", label: "Name" },
];

/**
 * Filter + sort, in one place so the map, the list and the exports can never
 * disagree about what is currently visible.
 */
export function visiblePoints() {
  const { filters, search, settings } = state;
  const needle = search.trim().toLowerCase();

  const filtered = state.points.filter((point) => {
    if (point.status === "rejected" && !settings.showRejected
      && !filters.statuses.includes("rejected")) return false;

    if (filters.statuses.length && !filters.statuses.includes(point.status)) return false;
    if (filters.kinds.length && !filters.kinds.includes(point.kind)) return false;

    if (filters.maxTMC !== null) {
      const tmc = tmcSortValue(point, settings);
      if (tmc !== null && tmc > filters.maxTMC) return false;
    }
    if (filters.gender && point.room?.gender && point.room.gender !== "any"
      && point.room.gender !== filters.gender) return false;

    if (filters.foodIncluded !== null && point.food?.included !== filters.foodIncluded) return false;

    if (filters.maxSharing !== null) {
      const sharing = num(point.room?.sharing);
      if (sharing !== null && sharing > filters.maxSharing) return false;
    }
    if (filters.tags.length && !filters.tags.every((tag) => point.tags?.includes(tag))) return false;

    if (filters.maxKmFromWork !== null) {
      const km = distanceFromWork(point, settings);
      if (km !== null && km > filters.maxKmFromWork) return false;
    }

    // The area you are hunting in: everything outside it is noise while you
    // are looking at one locality, so it is hidden rather than ranked low.
    if (settings.searchArea && filters.limitToArea && hasLocation(point)) {
      const km = haversineKm(
        { lat: point.lat, lng: point.lng },
        { lat: settings.searchArea.lat, lng: settings.searchArea.lng },
      );
      if (km !== null && km > (num(settings.searchRadiusKm) ?? 5)) return false;
    }
    if (needle && !pointSearchText(point).includes(needle)) return false;
    return true;
  });

  return sortPoints(filtered);
}

/** Unknown values sort last in every mode — a blank rent is not the cheapest. */
function sortPoints(points) {
  const { sort, settings } = state;
  const lastIfNull = (value) => (value === null || value === undefined ? Infinity : value);

  const keys = {
    tmc: (point) => lastIfNull(tmcSortValue(point, settings)),
    rent: (point) => lastIfNull(num(point.costs?.rent)),
    cash: (point) => lastIfNull(cashDayOne(point)),
    distance: (point) => lastIfNull(distanceFromWork(point, settings)),
    verified: (point) => new Date(point.lastVerifiedAt || 0).getTime(),
    updated: (point) => -new Date(point.updatedAt || 0).getTime(),
    completeness: (point) => -completeness(point),
    name: (point) => (point.name || "").toLowerCase(),
  };

  const keyFn = keys[sort] || keys.tmc;
  return [...points].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (typeof ka === "string") return ka.localeCompare(kb);
    return ka - kb;
  });
}

export const mappablePoints = () => visiblePoints().filter(hasLocation);

export const allTags = () =>
  Array.from(new Set(state.points.flatMap((point) => point.tags || []))).sort();

export const staleCount = () =>
  state.points.filter((point) => isStale(point, state.settings)).length;

/** Nearby points, for the duplicate-merge prompt (T-009). */
export function nearbyPoints(lat, lng, metres = 80, excludeId = null) {
  if (num(lat) === null) return [];
  return state.points.filter((point) => {
    if (point.id === excludeId || !hasLocation(point)) return false;
    const km = haversineKm({ lat, lng }, { lat: point.lat, lng: point.lng });
    return km !== null && km * 1000 <= metres;
  });
}

/* --------------------------------------------------------- import / export -- */

export function exportDoc() {
  return {
    version: SCHEMA_VERSION,
    exportedAt: nowISO(),
    settings: state.settings,
    points: state.points,
  };
}

export function exportJSON() {
  const filename = `point-map-${todayISO()}.json`;
  download(filename, JSON.stringify(exportDoc(), null, 2));
  commit(() => {
    state.settings.lastBackupAt = nowISO();
    state.settings.writesSinceBackup = 0;
  }, "backup");
  return filename;
}

/**
 * Import replaces everything, after an explicit confirmation upstream. Merging
 * two divergent copies needs per-point conflict resolution the user would have
 * to adjudicate — out of scope until T-015 makes it a real scenario.
 */
export function importJSON(text) {
  const doc = JSON.parse(text);
  if (!doc || !Array.isArray(doc.points)) {
    throw new Error("That file has no `points` array — is it a point_map export?");
  }
  const migrated = migrate(doc);
  commit(() => {
    state.points = migrated.points;
    state.settings = { ...migrated.settings, lastBackupAt: nowISO(), writesSinceBackup: 0 };
    state.selectedId = null;
    state.compareIds = [];
  }, "import");
  return migrated.points.length;
}

const CSV_COLUMNS = [
  ["Name", (point) => point.name],
  ["Status", (point) => point.status],
  ["Type", (point) => point.kind],
  ["Area", (point) => point.area],
  ["Address", (point) => point.address],
  ["Contact", (point) => point.contact?.person],
  ["Phone", (point) => point.contact?.phone],
  ["Source", (point) => point.contact?.source],
  ["Rent", (point) => num(point.costs?.rent)],
  ["Deposit", (point) => num(point.costs?.deposit)],
  ["Brokerage", (point) => num(point.costs?.brokerage)],
  ["Utilities", (point) => num(point.costs?.utilities)],
  ["Food included", (point) => point.food?.included],
  ["Commute/mo", (point) => num(point.costs?.commuteMonthly)],
  ["Sharing", (point) => num(point.room?.sharing)],
  ["Minutes to work", (point) => num(point.commute?.minutesToWork)],
  ["True monthly cost", (point, settings) => round(tmcSortValue(point, settings))],
  ["Day-one cash", (point) => round(cashDayOne(point))],
  ["Net cost of stay", (point, settings) => round(netCostOfStay(point, settings))],
  ["Adjusted TMC", (point, settings) => round(adjustedTMC(point, settings))],
  ["Km from work", (point, settings) => distanceFromWork(point, settings)],
  ["Lat", (point) => point.lat],
  ["Lng", (point) => point.lng],
  ["Last verified", (point) => point.lastVerifiedAt],
  ["Why rejected", (point) => point.rejectedReason],
  ["Notes", (point) => point.notes],
];

const round = (value) => (value === null || value === undefined ? "" : Math.round(value));

export function exportCSV(points = visiblePoints()) {
  const rows = [
    CSV_COLUMNS.map(([label]) => label),
    ...points.map((point) => CSV_COLUMNS.map(([, read]) => {
      const value = read(point, state.settings);
      return value === null || value === undefined ? "" : value;
    })),
  ];
  const filename = `point-map-${todayISO()}.csv`;
  download(filename, toCSV(rows), "text/csv");
  return filename;
}

/* ------------------------------------------------------------ backup nudge -- */

/**
 * Data loss is the most likely way this project dies (ADR-0002), so staleness
 * is surfaced as a number the user can see rather than a dialog they dismiss.
 */
export function backupStatus() {
  const { lastBackupAt, writesSinceBackup } = state.settings;
  const days = lastBackupAt
    ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000)
    : null;
  const writes = num(writesSinceBackup) ?? 0;
  return {
    lastBackupAt,
    days,
    writes,
    overdue: days === null ? state.points.length > 2 : days >= 7 || writes >= 10,
  };
}
