/**
 * Wiring. Creates the map, renders the views, and owns the small amount of
 * cross-cutting behaviour: view switching, map-click modes, keyboard shortcuts
 * and the backup nag.
 *
 * Rendering is deliberately coarse — a store change repaints whole panels.
 * At a few dozen points that is imperceptible, and it removes every question
 * about stale UI (ADR-0003).
 */

import { el, qs, num, relTime, parseCoords, todayISO } from "./lib/util.js";
import { pointTitle } from "./model.js";
import * as store from "./store.js";
import { createMapController } from "./map/index.js";
import { renderSidebar } from "./ui/list.js";
import { renderDetail } from "./ui/detail.js";
import { renderCompare } from "./ui/compare.js";
import { renderMoney } from "./ui/money.js";
import { openPointForm } from "./ui/form.js";
import { toast } from "./ui/toast.js";

const nodes = {
  sidebar: qs("#sidebar"),
  drawer: qs("#drawer"),
  workspace: qs("#workspace"),
  compare: qs("#view-compare"),
  money: qs("#view-money"),
  tabs: qs("#tabs"),
  mapHint: qs("#map-hint"),
  mapStatus: qs("#map-status"),
  providerChip: qs("#provider-chip"),
  backupChip: qs("#backup-chip"),
  addBtn: qs("#add-btn"),
  compareBadge: qs("#compare-badge"),
  installBtn: qs("#install-btn"),
  offlineChip: qs("#offline-chip"),
};

let map = null;

/**
 * When set, the next map click is captured instead of starting a new pin.
 * `{ kind: "point" | "work", draft, isExisting }`
 */
let pickMode = null;

/* ------------------------------------------------------------- map clicks -- */

function handleMapClick({ lat, lng }) {
  if (pickMode?.kind === "work") {
    store.updateSettings({ workPin: { lat, lng, label: pickMode.label || "Work" } });
    endPickMode();
    toast("Work location set — distances and the commute lens now work");
    return;
  }

  if (pickMode?.kind === "point") {
    const { draft, isExisting } = pickMode;
    endPickMode();
    if (isExisting) {
      store.updatePoint(draft.id, { lat, lng });
      toast(`Moved ${pointTitle(draft)}`);
      openPointForm({ pointId: draft.id, onRequestPick: requestPickLocation });
    } else {
      openPointForm({
        initial: { ...draft, lat, lng },
        onRequestPick: requestPickLocation,
      });
    }
    return;
  }

  // Default: a click on empty map is the fastest way to add a place.
  openPointForm({ initial: { lat, lng }, onRequestPick: requestPickLocation });
}

function requestPickLocation(draft, isExisting) {
  pickMode = { kind: "point", draft, isExisting };
  showHint(
    isExisting ? `Click the map to move “${pointTitle(draft)}”` : "Click the map to place this pin",
    "Esc to cancel",
  );
}

function requestPickWork() {
  pickMode = { kind: "work", label: "Work" };
  store.setUI({ view: "map" });
  showHint("Click the map where you work", "Esc to cancel");
}

function showHint(text, sub) {
  nodes.mapHint.replaceChildren(
    el("strong", { text }),
    sub && el("span", { class: "muted", text: ` — ${sub}` }),
  );
  nodes.mapHint.hidden = false;
  document.body.classList.add("is-picking");
}

function endPickMode() {
  pickMode = null;
  nodes.mapHint.hidden = true;
  document.body.classList.remove("is-picking");
}

/* --------------------------------------------------------------- rendering -- */

function renderTopbar() {
  const state = store.getState();
  const backup = store.backupStatus();

  for (const tab of nodes.tabs.querySelectorAll(".tab")) {
    tab.classList.toggle("is-active", tab.dataset.view === state.view);
  }

  nodes.compareBadge.hidden = state.compareIds.length === 0;
  nodes.compareBadge.textContent = String(state.compareIds.length);

  if (map) {
    nodes.providerChip.textContent = map.providerLabel;
    nodes.providerChip.title = map.providerNote
      || `${map.providerLabel} — change it in app/config.js`;
  }

  nodes.backupChip.textContent = backup.lastBackupAt
    ? `backup ${relTime(backup.lastBackupAt)}`
    : "never backed up";
  nodes.backupChip.classList.toggle("chip--warn", backup.overdue);
  nodes.backupChip.title = "Download a JSON backup (⌘/Ctrl + S)";
}

function renderView() {
  const state = store.getState();
  const isMap = state.view === "map";

  nodes.workspace.hidden = !isMap;
  nodes.compare.hidden = state.view !== "compare";
  nodes.money.hidden = state.view !== "money";

  if (isMap) {
    // Leaflet and Google both need a nudge after their container is re-shown.
    requestAnimationFrame(() => map?.invalidateSize());
  } else if (state.view === "compare") {
    renderCompare(nodes.compare);
  } else if (state.view === "money") {
    renderMoney(nodes.money, { onPickWorkPin: requestPickWork });
  }
}

function renderAll(reason) {
  const state = store.getState();

  renderTopbar();
  renderSidebar(nodes.sidebar, {
    onSelect: (id) => {
      store.select(id);
      const point = store.pointById(id);
      if (point) map?.focusPoint(point, Math.max(map.getZoom() ?? 0, 14));
    },
    getViewportIds: () => map?.idsInView(),
  });

  const selected = store.selectedPoint();
  if (selected) {
    const scroll = nodes.drawer.scrollTop;
    nodes.drawer.hidden = false;
    renderDetail(nodes.drawer, selected, {
      onEdit: (point) => openPointForm({ pointId: point.id, onRequestPick: requestPickLocation }),
      onFocus: (point) => map?.focusPoint(point),
    });
    // Repaints are whole-panel, so the scroll position has to be carried over
    // or every edit would throw the user back to the top of the drawer.
    nodes.drawer.scrollTop = scroll;
  } else {
    nodes.drawer.hidden = true;
    nodes.drawer.replaceChildren();
  }

  map?.setData(store.visiblePoints(), {
    selectedId: state.selectedId,
    settings: state.settings,
  });

  renderView();

  if (reason === "save-error") {
    toast("Could not save — this browser's storage is full. Export a backup now and clear some uploaded media.",
      { level: "error", timeout: 12000 });
  }
}

/* --------------------------------------------------------------- shortcuts -- */

function onKeydown(event) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;

  if (event.key === "Escape") {
    if (pickMode) {
      endPickMode();
      return;
    }
    if (!typing && store.getState().selectedId) store.select(null);
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    toast(`Saved ${store.exportJSON()}`);
    return;
  }

  if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.key.toLowerCase()) {
    case "n":
      event.preventDefault();
      openPointForm({ onRequestPick: requestPickLocation });
      break;
    case "e": {
      const selected = store.selectedPoint();
      if (selected) {
        event.preventDefault();
        openPointForm({ pointId: selected.id, onRequestPick: requestPickLocation });
      }
      break;
    }
    case "/":
      event.preventDefault();
      qs("#sidebar-search")?.focus();
      break;
    case "1": store.setUI({ view: "map" }); break;
    case "2": store.setUI({ view: "compare" }); break;
    case "3": store.setUI({ view: "money" }); break;
    case "f": map?.fitAll(); break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ nudges -- */

/**
 * Two one-time prompts. Both are deliberately conditional on there being
 * something at stake — an unprompted settings tour is noise.
 */
function runNudges() {
  const state = store.getState();
  const backup = store.backupStatus();

  if (backup.overdue) {
    toast(
      backup.lastBackupAt
        ? `Last backup was ${relTime(backup.lastBackupAt)}. Everything lives in this browser only.`
        : "Your research lives in this browser only. One click makes a backup file.",
      {
        level: "warn",
        timeout: 9000,
        action: { label: "Back up now", onClick: () => toast(`Saved ${store.exportJSON()}`) },
      },
    );
  }

  const withCommute = state.points.filter((point) => num(point.commute?.minutesToWork) !== null);
  const spread = withCommute.length >= 2
    && Math.max(...withCommute.map((p) => p.commute.minutesToWork))
     - Math.min(...withCommute.map((p) => p.commute.minutesToWork)) >= 20;

  if (spread && !num(state.settings.timeValuePerHour) && !state.settings.promptedTimeValue) {
    store.updateSettings({ promptedTimeValue: true });
    toast("Your options differ by 20+ minutes of commute. Pricing that time can reverse which one is cheapest.", {
      timeout: 11000,
      action: {
        label: "Set a ₹/hour value",
        onClick: () => store.setUI({ view: "money" }),
      },
    });
  }
}

/* --------------------------------------------------------------------- pwa -- */

/**
 * Installing to a phone home screen and working with no signal.
 *
 * The data layer was always offline — this makes the *page* and the map tiles
 * survive a dead zone too, which is exactly where PG notes get written.
 */
function setupPWA() {
  const canUseSW = "serviceWorker" in navigator
    && (location.protocol === "https:" || location.hostname === "localhost");

  if (canUseSW) {
    navigator.serviceWorker.register("sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const incoming = registration.installing;
        incoming?.addEventListener("statechange", () => {
          // A waiting worker with a page already controlled means this is an
          // update, not a first install — worth telling the user about.
          if (incoming.state !== "installed" || !navigator.serviceWorker.controller) return;
          toast("A new version is ready.", {
            timeout: 0,
            action: { label: "Reload", onClick: () => incoming.postMessage("SKIP_WAITING") },
          });
        });
      });
    }).catch((err) => console.warn("Service worker registration failed", err));

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return; // the event can fire more than once
      reloading = true;
      location.reload();
    });
  }

  /* Chrome/Android offer an install prompt we can trigger on a real click.
     iOS has no equivalent — Safari's Share → Add to Home Screen is manual,
     which docs/use-on-your-phone.md explains. */
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    nodes.installBtn.hidden = false;
  });

  nodes.installBtn?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    nodes.installBtn.hidden = true;
    if (outcome === "accepted") toast("Installed — open it from your home screen");
  });

  window.addEventListener("appinstalled", () => {
    nodes.installBtn.hidden = true;
  });

  const syncOnlineState = () => {
    const offline = !navigator.onLine;
    nodes.offlineChip.hidden = !offline;
    document.body.classList.toggle("is-offline", offline);
  };

  window.addEventListener("online", syncOnlineState);
  window.addEventListener("offline", syncOnlineState);
  syncOnlineState();
}

/* -------------------------------------------------------------------- boot -- */

async function boot() {
  store.load();
  setupPWA();

  nodes.tabs.addEventListener("click", (event) => {
    const view = event.target.closest(".tab")?.dataset.view;
    if (view) store.setUI({ view });
  });

  nodes.addBtn.addEventListener("click", () => {
    openPointForm({ onRequestPick: requestPickLocation });
  });

  nodes.backupChip.addEventListener("click", () => {
    toast(`Saved ${store.exportJSON()}`);
  });

  document.addEventListener("keydown", onKeydown);

  /* Paste a Google Maps link anywhere to drop a pin there. */
  document.addEventListener("paste", (event) => {
    const target = event.target;
    if (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable) return;
    const coords = parseCoords(event.clipboardData?.getData("text") || "");
    if (!coords) return;
    event.preventDefault();
    map?.focus(coords.lat, coords.lng, 16);
    openPointForm({
      initial: { ...coords, lastVerifiedAt: todayISO() },
      onRequestPick: requestPickLocation,
    });
  });

  try {
    map = await createMapController({
      container: qs("#map"),
      settings: store.getSettings(),
      onSelect: (id) => store.select(id),
      onMapClick: handleMapClick,
      onViewportChange: () => {
        // Only the sidebar cares, and only when it is filtered to the viewport.
        if (store.getState().viewportOnly) {
          renderSidebar(nodes.sidebar, {
            onSelect: (id) => store.select(id),
            getViewportIds: () => map?.idsInView(),
          });
        }
      },
      onStatus: (status) => {
        nodes.mapStatus.textContent = status.capped
          ? `${status.inView} here — zoom in to see prices`
          : status.tier === "cluster" && status.total > status.shown
            ? "Zoom in to separate the clusters"
            : "";
        if (status.note) {
          nodes.providerChip.title = status.note;
          nodes.providerChip.classList.add("chip--warn");
        }
      },
    });
  } catch (err) {
    console.error("Map failed to start", err);
    nodes.mapStatus.textContent = "The map couldn't load, but the list, compare and money views all work.";
    toast("Map failed to load — check your connection. Everything else still works.", {
      level: "error",
      timeout: 8000,
    });
  }

  store.subscribe((_, reason) => renderAll(reason));
  renderAll("boot");

  if (store.getPoints().some((point) => num(point.lat) !== null)) map?.fitAll();

  setTimeout(runNudges, 1200);
}

boot();
