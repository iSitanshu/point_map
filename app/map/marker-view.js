/**
 * Everything about how a pin *looks*, shared by both map providers so the map
 * is identical whichever one is running. The providers place these elements and
 * wire their own click handling; they know nothing about status, price or zoom.
 *
 * Governing decision: decisions/ADR-0004-marker-readability.md
 *
 *   zoom ≤ 11   cluster bubble — "7 · ₹14k"
 *   zoom 12–14  price pill     — "₹15k"
 *   zoom ≥ 15   expanded pill  — "₹15k · 3-share" + thumbnail
 *
 * plus a hard cap on how many pills may be drawn at once, which is the specific
 * thing that stops forty markers turning into grey soup.
 */

import { el, compactINR, num } from "../lib/util.js";
import { statusMeta, kindMeta, pointTitle, isStale } from "../model.js";
import { tmcSortValue } from "../lib/money.js";
import { thumbnailFor } from "../media.js";

export const TIERS = { CLUSTER: "cluster", PILL: "pill", DETAIL: "detail" };

export function tierForZoom(zoom) {
  if (zoom <= 11) return TIERS.CLUSTER;
  if (zoom < 15) return TIERS.PILL;
  return TIERS.DETAIL;
}

/* ------------------------------------------------------------- clustering -- */

/**
 * Grid clustering, deliberately crude: at the only zoom level where clusters
 * are shown, "roughly this neighbourhood" is all the precision needed, and a
 * grid is predictable in a way that centroid clustering is not (pins don't
 * jump between groups as one is added).
 */
export function buildClusters(points, zoom) {
  const cell = 0.12 / 2 ** Math.max(0, zoom - 9);
  const cells = new Map();

  for (const point of points) {
    const key = `${Math.floor(point.lat / cell)}:${Math.floor(point.lng / cell)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(point);
  }

  return Array.from(cells.entries()).map(([key, members]) => ({
    key,
    points: members,
    lat: members.reduce((sum, p) => sum + p.lat, 0) / members.length,
    lng: members.reduce((sum, p) => sum + p.lng, 0) / members.length,
  }));
}

const median = (values) => {
  const sorted = values.filter((v) => v !== null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/* -------------------------------------------------------------- rendering -- */

/** Resolved thumbnails are cached — markers re-render on every zoom change. */
const thumbCache = new Map();

function attachThumbnail(imgNode, point) {
  if (thumbCache.has(point.id)) {
    const cached = thumbCache.get(point.id);
    if (cached) imgNode.src = cached;
    else imgNode.remove();
    return;
  }
  Promise.resolve(thumbnailFor(point)).then((url) => {
    thumbCache.set(point.id, url || null);
    if (url) imgNode.src = url;
    else imgNode.remove();
  }).catch(() => imgNode.remove());
}

export const invalidateThumb = (pointId) => thumbCache.delete(pointId);

/**
 * One pin.
 *
 * `tier` controls how much is written on it; `dimmed` fades everything that is
 * not the current selection so the selected pin reads at a glance.
 */
export function renderPin(point, { tier, selected = false, dimmed = false, settings = {} } = {}) {
  const status = statusMeta(point.status);
  const kind = kindMeta(point.kind);
  const tmc = tmcSortValue(point, settings);
  const rent = num(point.costs?.rent);
  const price = tmc ?? rent;
  const stale = isStale(point, settings);

  const classes = [
    "pin",
    tier === TIERS.CLUSTER ? "pin--dot" : "pin--pill",
    tier === TIERS.DETAIL && "pin--detail",
    selected && "is-selected",
    dimmed && "is-dimmed",
    stale && "is-stale",
  ];

  const children = [];

  if (tier === TIERS.CLUSTER) {
    // A lone point at city zoom still shows its price — the whole purpose of
    // the map is answering "where are the cheap ones?" without clicking.
    children.push(el("span", { class: "pin__dot-label", text: compactINR(price) }));
  } else {
    children.push(el("span", { class: "pin__price", text: compactINR(price) }));

    if (tier === TIERS.DETAIL) {
      const sharing = num(point.room?.sharing);
      const meta = [
        sharing === 1 ? "single" : sharing ? `${sharing}-share` : null,
        point.food?.included === true ? "food" : null,
      ].filter(Boolean).join(" · ");

      if (meta) children.push(el("span", { class: "pin__meta", text: meta }));
      if (point.media?.length) {
        const img = el("img", { class: "pin__thumb", alt: "" });
        attachThumbnail(img, point);
        children.push(img);
      }
    }
  }

  const node = el("div", {
    class: classes,
    style: { "--status-color": status.color },
    title: `${kind.icon} ${pointTitle(point)} — ${status.label}${stale ? " · needs re-checking" : ""}`,
    dataset: { pointId: point.id },
  }, [
    ...children,
    el("span", { class: "pin__tail" }),
  ]);

  return node;
}

/** A cluster bubble: how many, and the median asking price inside it. */
export function renderCluster(cluster, { settings = {} } = {}) {
  const prices = cluster.points.map((point) => tmcSortValue(point, settings) ?? num(point.costs?.rent));
  const mid = median(prices);

  // Colour the bubble by the most advanced status inside it, so a cluster
  // containing a shortlisted place still reads as interesting.
  const priority = ["current", "shortlist", "visited", "toVisit", "lead", "rejected"];
  const best = priority.find((status) => cluster.points.some((point) => point.status === status)) || "lead";

  return el("div", {
    class: "pin pin--cluster",
    style: { "--status-color": statusMeta(best).color },
    title: `${cluster.points.length} places here — zoom in to separate them`,
  }, [
    el("b", { class: "pin__count", text: String(cluster.points.length) }),
    mid !== null && el("span", { class: "pin__cluster-price", text: compactINR(mid) }),
  ]);
}

/**
 * A rail or metro station. Deliberately quiet: stations are the backdrop you
 * judge a PG against, not something to click. Name only once you are zoomed in
 * far enough for it to be legible.
 */
export function renderStation(station, { zoom = 13 } = {}) {
  const showName = zoom >= 14;
  return el("div", {
    class: ["station", station.metro && "station--metro", showName && "station--named"],
    title: `${station.name} ${station.metro ? "metro" : "railway"} station`,
  }, [
    el("span", { class: "station__icon", text: station.metro ? "Ⓜ" : "🚆" }),
    showName && el("span", { class: "station__name", text: station.name }),
  ]);
}

/** Where you are now. Pulsing, so it is never confused with a saved place. */
export function renderMyLocation() {
  return el("div", { class: "me", title: "Your current location" }, [
    el("span", { class: "me__pulse" }),
    el("span", { class: "me__dot" }),
  ]);
}

/** The work pin — a different shape so it never reads as an option. */
export function renderWorkPin(label = "Work") {
  return el("div", { class: "pin pin--work", title: label }, [
    el("span", { class: "pin__work-icon", text: "💼" }),
    el("span", { class: "pin__work-label", text: label }),
  ]);
}

/**
 * Pin positions are nudged apart when they would overlap, rather than being
 * merged — three PGs in one lane is real information, and hiding it to tidy
 * the map would be hiding the answer.
 */
export function spreadOverlaps(items, degrees = 0.00035) {
  const seen = new Map();
  return items.map((item) => {
    const key = `${item.lat.toFixed(4)}:${item.lng.toFixed(4)}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return item;

    // Walk outward on a small circle: predictable, and keeps the pin in its lane.
    const angle = (count * 2.39996) % (Math.PI * 2); // golden angle, avoids collisions
    return {
      ...item,
      lat: item.lat + Math.sin(angle) * degrees * Math.ceil(count / 6),
      lng: item.lng + Math.cos(angle) * degrees * Math.ceil(count / 6),
      nudged: true,
    };
  });
}
