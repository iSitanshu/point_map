/**
 * Small helpers shared across the app. No dependencies.
 *
 * `el()` is the one that earns its keep: it stands in for JSX, so DOM building
 * stays a single expression instead of ten lines of createElement/append.
 */

/* ------------------------------------------------------------------ DOM ---- */

/**
 * el("div", { class: "card", on: { click: fn } }, ["text", childNode])
 *
 * Attribute handling: `class` accepts a string or an array (falsy entries
 * dropped), `text`/`html` set content, `dataset` and `style` take objects,
 * `on` takes an event map. Anything that is a real DOM property is set as a
 * property (so `value`, `checked`, `hidden` behave); everything else becomes
 * an attribute. Null/undefined/false values are skipped entirely.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === "class" || key === "className") {
      node.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : value;
    } else if (key === "text") {
      node.textContent = value;
    } else if (key === "html") {
      node.innerHTML = value;
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key === "style") {
      if (typeof value === "string") node.style.cssText = value;
      else Object.assign(node.style, value);
    } else if (key === "on") {
      for (const [event, fn] of Object.entries(value)) node.addEventListener(event, fn);
    } else if (key in node && key !== "list" && key !== "form" && key !== "size") {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : value);
    }
  }

  append(node, children);
  return node;
}

/** Append strings, numbers, nodes, or nested arrays of them. Falsy entries skipped. */
export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false || child === "") continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
  return parent;
}

export const frag = (children) => append(document.createDocumentFragment(), children);
export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Replace a container's contents in one shot. */
export function render(container, children) {
  if (!container) return container;
  clear(container);
  append(container, children);
  return container;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

/* ----------------------------------------------------------------- data ---- */

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** getPath(obj, "costs.rent") — undefined rather than throwing on a missing branch. */
export function getPath(object, path) {
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), object);
}

/** setPath(obj, "costs.rent", 15000) — creates intermediate objects as needed. */
export function setPath(object, path, value) {
  const keys = String(path).split(".");
  const last = keys.pop();
  let target = object;
  for (const key of keys) {
    if (typeof target[key] !== "object" || target[key] === null) target[key] = {};
    target = target[key];
  }
  target[last] = value;
  return object;
}

export const deepClone = (value) => (typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));

export function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * A finite number, or null. The whole money engine depends on this distinction:
 * an empty rent field is unknown, not ₹0 (see ADR-0005).
 */
export function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Sum, treating null as zero but keeping null when every input is null. */
export function sumKnown(values) {
  const known = values.map(num).filter((v) => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

export const slugify = (value) => String(value).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

export const unique = (list) => Array.from(new Set(list));

/* ---------------------------------------------------------------- money ---- */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹1,23,456 — or an em dash when the value is unknown. */
export function formatINR(value) {
  const n = num(value);
  return n === null ? "—" : inrFormatter.format(Math.round(n));
}

/** ₹15k / ₹9.5k / ₹1.2L — for map pills and tight columns. */
export function compactINR(value) {
  const n = num(value);
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${trimZero(n / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trimZero(n / 1e5)}L`;
  if (abs >= 1000) return `₹${trimZero(n / 1000)}k`;
  return `₹${Math.round(n)}`;
}

const trimZero = (value) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/** +₹1,200 / −₹800 — a signed delta, for budget comparisons. */
export function signedINR(value) {
  const n = num(value);
  if (n === null) return "—";
  if (n === 0) return "on budget";
  return `${n > 0 ? "+" : "−"}${formatINR(Math.abs(n))}`;
}

/* ----------------------------------------------------------------- time ---- */

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const nowISO = () => new Date().toISOString();

export function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** "today" / "3d ago" / "2mo ago" — compact enough for a chip. */
export function relTime(iso) {
  const days = daysSince(iso);
  if (days === null) return "never";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/** Month key for grouping ledger rows: "2026-11". */
export const monthKey = (iso) => String(iso || "").slice(0, 7);

export function monthLabel(key) {
  const [year, month] = String(key).split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** Add whole months to an ISO date, clamping to the end of a short month. */
export function addMonths(iso, count) {
  const date = new Date(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ geo ---- */

/** Straight-line km between two {lat, lng} points. */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Pull coordinates out of a pasted Google Maps URL or a bare "19.07, 72.87". */
export function parseCoords(text) {
  if (!text) return null;
  const atMatch = String(text).match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const qMatch = String(text).match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  const bare = String(text).match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  const match = atMatch || qMatch || bare;
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/* ------------------------------------------------------------------- io ---- */

export function download(filename, content, type = "application/json") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Quote a CSV cell: wrap in quotes and double any inner quote. */
export const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCSV = (rows) => rows.map((row) => row.map(csvCell).join(",")).join("\n");

/** A wa.me deep link. Indian numbers get 91 prepended when they are bare 10-digit. */
export function whatsappLink(phone, message = "") {
  const digits = digitsOnly(phone);
  if (!digits) return null;
  const withCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCode}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
