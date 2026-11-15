/**
 * The controls that sit on top of the map.
 *
 * Built around one question: "show me what's in this area" — so you type a
 * locality once and the map and the list both stay there, instead of panning
 * around looking for your own pins every time you open the app.
 */

import { el, num } from "../lib/util.js";
import { MMR_LOCALITIES, searchArea, getCurrentPosition } from "../lib/geo.js";
import { toast } from "./toast.js";
import * as store from "../store.js";

const RADII = [2, 5, 10, 25];

export function renderMapControls(container, { map, onAreaChange } = {}) {
  const settings = store.getSettings();
  const area = settings.searchArea;

  const results = el("div", { class: "area-results", hidden: true });

  const input = el("input", {
    class: "control area-search__input",
    type: "search",
    list: "mmr-localities",
    placeholder: area ? area.label : "Search an area — e.g. Andheri East",
    "aria-label": "Jump to an area",
    value: "",
  });

  const setBusy = (busy) => {
    input.classList.toggle("is-busy", busy);
    input.disabled = busy;
  };

  function applyArea(choice) {
    store.setSearchArea({ label: choice.label, lat: choice.lat, lng: choice.lng });
    map?.focus(choice.lat, choice.lng, 14);
    results.hidden = true;
    input.value = "";
    toast(`Showing places within ${settings.searchRadiusKm ?? 5} km of ${choice.label}`);
    onAreaChange?.();
  }

  async function runSearch() {
    const query = input.value.trim();
    if (!query) return;

    setBusy(true);
    try {
      const found = await searchArea(query);
      if (!found.length) {
        toast(`Couldn't find "${query}". Try a nearby landmark or a station name.`, { level: "warn" });
        return;
      }
      if (found.length === 1) {
        applyArea(found[0]);
        return;
      }
      // More than one match — let the user pick rather than guessing for them.
      results.replaceChildren(...found.map((choice) => el("button", {
        class: "area-results__item",
        type: "button",
        on: { click: () => applyArea(choice) },
      }, [
        el("strong", { text: choice.label }),
        el("small", { class: "muted", text: choice.full }),
      ])));
      results.hidden = false;
    } catch (err) {
      toast(err.message || "Area search failed — are you offline?", { level: "warn" });
    } finally {
      setBusy(false);
    }
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
    if (event.key === "Escape") results.hidden = true;
  });

  /* --- my location ------------------------------------------------------ */

  async function locate() {
    const button = container.querySelector(".map-btn--locate");
    button?.classList.add("is-busy");
    try {
      const position = await getCurrentPosition();
      map?.setMyLocation(position);
      map?.focus(position.lat, position.lng, 15);
      toast("Found you. Tap the map to drop a pin here, or set this as your area.", {
        timeout: 7000,
        action: {
          label: "Set as my area",
          onClick: () => applyArea({ label: "My location", lat: position.lat, lng: position.lng }),
        },
      });
    } catch (err) {
      toast(err.message, { level: "warn", timeout: 8000 });
    } finally {
      button?.classList.remove("is-busy");
    }
  }

  /* --- the area chip ---------------------------------------------------- */

  const chip = area
    ? el("div", { class: "area-chip" }, [
      el("span", { class: "area-chip__label", title: area.label }, ["📍 ", area.label]),
      el("select", {
        class: "area-chip__radius",
        "aria-label": "Search radius",
        on: {
          change: (event) => {
            store.updateSettings({ searchRadiusKm: num(event.target.value) ?? 5 });
            onAreaChange?.();
          },
        },
      }, RADII.map((km) => el("option", {
        value: km,
        text: `${km} km`,
        selected: (num(settings.searchRadiusKm) ?? 5) === km,
      }))),
      el("button", {
        class: "area-chip__clear",
        type: "button",
        title: "Show everywhere again",
        text: "✕",
        on: {
          click: () => {
            store.setSearchArea(null);
            onAreaChange?.();
          },
        },
      }),
    ])
    : null;

  container.replaceChildren(
    el("div", { class: "map-controls__row" }, [
      el("div", { class: "area-search" }, [
        el("span", { class: "area-search__icon", text: "🔍" }),
        input,
        el("datalist", { id: "mmr-localities" },
          MMR_LOCALITIES.map((name) => el("option", { value: name }))),
        results,
      ]),
      el("button", {
        class: "map-btn map-btn--locate",
        type: "button",
        title: "Use my current location",
        "aria-label": "Use my current location",
        text: "◎",
        on: { click: locate },
      }),
      el("button", {
        class: ["map-btn", settings.showStations !== false && "is-on"],
        type: "button",
        title: settings.showStations !== false ? "Hide stations" : "Show railway & metro stations",
        "aria-label": "Toggle stations",
        text: "Ⓜ",
        on: {
          click: () => store.updateSettings({ showStations: settings.showStations === false }),
        },
      }),
    ]),
    chip,
  );

  return container;
}
