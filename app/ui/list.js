/**
 * The sidebar: search, filters, sort, and the list of locations.
 *
 * The list is what makes the map's dot tiers acceptable (ADR-0004) — whatever
 * the pins are doing at the current zoom, the cheapest option is always legible
 * here, sorted by true monthly cost.
 */

import { el, formatINR, compactINR, num, relTime, debounce } from "../lib/util.js";
import { STATUSES, KINDS, statusMeta, kindMeta, pointTitle, isStale } from "../model.js";
import { tmcBreakdown, cashDayOne, distanceFromWork, budgetDelta } from "../lib/money.js";
import * as store from "../store.js";

/** Pins carry data-point-id, so the hover link works under either provider. */
function pulsePin(pointId, on) {
  const pin = document.querySelector(`.pin[data-point-id="${pointId}"]`);
  pin?.classList.toggle("is-hovered", on);
}

/* ----------------------------------------------------------------- filters -- */

function filterPanel() {
  const { filters, settings } = store.getState();
  const tags = store.allTags();

  const statusToggles = el("div", { class: "filter-chips" }, STATUSES.map((status) => el("button", {
    class: ["chip", "chip--filter", filters.statuses.includes(status.value) && "is-on"],
    style: { "--status-color": status.color },
    type: "button",
    text: status.label,
    on: {
      click: () => {
        const next = filters.statuses.includes(status.value)
          ? filters.statuses.filter((value) => value !== status.value)
          : [...filters.statuses, status.value];
        store.setFilters({ statuses: next });
      },
    },
  })));

  const kindToggles = el("div", { class: "filter-chips" }, KINDS.map((kind) => el("button", {
    class: ["chip", "chip--filter", filters.kinds.includes(kind.value) && "is-on"],
    type: "button",
    text: `${kind.icon} ${kind.label}`,
    on: {
      click: () => {
        const next = filters.kinds.includes(kind.value)
          ? filters.kinds.filter((value) => value !== kind.value)
          : [...filters.kinds, kind.value];
        store.setFilters({ kinds: next });
      },
    },
  })));

  const budgetSlider = el("input", {
    class: "control control--range",
    type: "range",
    min: 5000,
    max: 60000,
    step: 500,
    value: filters.maxTMC ?? 60000,
    on: {
      input: (event) => {
        const value = num(event.target.value);
        store.setFilters({ maxTMC: value >= 60000 ? null : value });
      },
    },
  });

  return el("div", { class: "filters" }, [
    el("div", { class: "filters__block" }, [
      el("span", { class: "filters__label", text: "Status" }),
      statusToggles,
    ]),
    el("div", { class: "filters__block" }, [
      el("span", { class: "filters__label", text: "Type" }),
      kindToggles,
    ]),
    el("div", { class: "filters__block" }, [
      el("span", {
        class: "filters__label",
        text: filters.maxTMC === null
          ? "True monthly cost — any"
          : `True monthly cost under ${formatINR(filters.maxTMC)}`,
      }),
      budgetSlider,
    ]),
    el("div", { class: "filters__block filters__block--row" }, [
      el("label", { class: "mini-field" }, [
        "Food",
        el("select", {
          class: "control control--inline",
          on: {
            change: (event) => {
              const value = event.target.value;
              store.setFilters({ foodIncluded: value === "" ? null : value === "yes" });
            },
          },
        }, [
          el("option", { value: "", text: "any", selected: filters.foodIncluded === null }),
          el("option", { value: "yes", text: "included", selected: filters.foodIncluded === true }),
          el("option", { value: "no", text: "not included", selected: filters.foodIncluded === false }),
        ]),
      ]),
      el("label", { class: "mini-field" }, [
        "Max sharing",
        el("select", {
          class: "control control--inline",
          on: { change: (event) => store.setFilters({ maxSharing: num(event.target.value) }) },
        }, [
          el("option", { value: "", text: "any", selected: filters.maxSharing === null }),
          ...[1, 2, 3, 4].map((n) => el("option", {
            value: n, text: n === 1 ? "single only" : `${n} or fewer`, selected: filters.maxSharing === n,
          })),
        ]),
      ]),
      settings.workPin && el("label", { class: "mini-field" }, [
        "Within",
        el("select", {
          class: "control control--inline",
          on: { change: (event) => store.setFilters({ maxKmFromWork: num(event.target.value) }) },
        }, [
          el("option", { value: "", text: "any distance", selected: filters.maxKmFromWork === null }),
          ...[3, 5, 10, 15, 25].map((km) => el("option", {
            value: km, text: `${km} km of work`, selected: filters.maxKmFromWork === km,
          })),
        ]),
      ]),
    ]),

    tags.length > 0 && el("div", { class: "filters__block" }, [
      el("span", { class: "filters__label", text: "Tags" }),
      el("div", { class: "filter-chips" }, tags.map((tag) => el("button", {
        class: ["chip", "chip--filter", filters.tags.includes(tag) && "is-on"],
        type: "button",
        text: `#${tag}`,
        on: {
          click: () => {
            const next = filters.tags.includes(tag)
              ? filters.tags.filter((value) => value !== tag)
              : [...filters.tags, tag];
            store.setFilters({ tags: next });
          },
        },
      }))),
    ]),

    el("div", { class: "filters__block filters__block--row" }, [
      el("label", { class: "mini-field mini-field--check" }, [
        el("input", {
          type: "checkbox",
          checked: Boolean(settings.showRejected),
          on: { change: (event) => store.updateSettings({ showRejected: event.target.checked }) },
        }),
        "Show rejected",
      ]),
      el("button", {
        class: "link-btn", type: "button", text: "Clear all filters",
        on: { click: () => store.resetFilters() },
      }),
    ]),
  ]);
}

/* -------------------------------------------------------------------- card -- */

function card(point, { settings, selectedId, compareIds, onSelect }) {
  const breakdown = tmcBreakdown(point, settings);
  const status = statusMeta(point.status);
  const kind = kindMeta(point.kind);
  const cash = cashDayOne(point);
  const km = distanceFromWork(point, settings);
  const delta = budgetDelta(point, settings);
  const stale = isStale(point, settings);
  const sharing = num(point.room?.sharing);

  const headline = breakdown.total !== null
    ? formatINR(Math.round(breakdown.total))
    : breakdown.low === null
      ? "—"
      : `${compactINR(breakdown.low)}–${compactINR(breakdown.high)}`;

  return el("article", {
    class: [
      "card",
      point.id === selectedId && "is-selected",
      stale && "is-stale",
      point.status === "rejected" && "is-rejected",
    ],
    style: { "--status-color": status.color },
    dataset: { pointId: point.id },
    on: {
      click: () => onSelect(point.id),
      mouseenter: () => pulsePin(point.id, true),
      mouseleave: () => pulsePin(point.id, false),
    },
  }, [
    el("div", { class: "card__top" }, [
      el("span", { class: "card__kind", text: kind.icon, title: kind.label }),
      el("h3", { class: "card__title", text: pointTitle(point) }),
      el("label", {
        class: "card__compare",
        title: "Add to the compare view",
        on: { click: (event) => event.stopPropagation() },
      }, [
        el("input", {
          type: "checkbox",
          checked: compareIds.includes(point.id),
          on: { change: () => store.toggleCompare(point.id) },
        }),
      ]),
    ]),

    el("div", { class: "card__money" }, [
      el("strong", { class: "card__tmc", text: headline }),
      el("span", { class: "card__tmc-label", text: "/mo all-in" }),
      cash !== null && el("span", { class: "card__cash", text: `${compactINR(cash)} day one` }),
    ]),

    el("div", { class: "card__meta" }, [
      point.area && el("span", { text: point.area }),
      sharing && el("span", { text: sharing === 1 ? "single" : `${sharing}-share` }),
      point.food?.included === true && el("span", { text: "food incl." }),
      km !== null && el("span", { text: `${km} km` }),
      num(point.commute?.minutesToWork) !== null && el("span", { text: `${point.commute.minutesToWork} min` }),
    ]),

    el("div", { class: "card__foot" }, [
      el("span", { class: "card__status", text: status.label }),
      breakdown.missing.length > 0 && el("span", {
        class: "card__missing",
        title: `Missing: ${breakdown.missing.join(", ")}`,
        text: `${breakdown.known}/7 known`,
      }),
      delta !== null && el("span", {
        class: ["card__delta", delta > 0 ? "is-over" : "is-under"],
        text: delta > 0 ? `${compactINR(delta)} over` : `${compactINR(-delta)} under`,
      }),
      stale && el("span", { class: "card__stale", text: `checked ${relTime(point.lastVerifiedAt)}` }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ public -- */

export function renderSidebar(container, { onSelect, getViewportIds } = {}) {
  const state = store.getState();
  const { settings } = state;
  let points = store.visiblePoints();

  const viewportOnly = Boolean(state.viewportOnly);
  if (viewportOnly && getViewportIds) {
    const ids = getViewportIds();
    if (ids) points = points.filter((point) => ids.includes(point.id));
  }

  const activeFilters = state.filters.statuses.length + state.filters.kinds.length
    + state.filters.tags.length
    + (state.filters.maxTMC !== null ? 1 : 0)
    + (state.filters.foodIncluded !== null ? 1 : 0)
    + (state.filters.maxSharing !== null ? 1 : 0)
    + (state.filters.maxKmFromWork !== null ? 1 : 0);

  const search = el("input", {
    class: "control search",
    type: "search",
    id: "sidebar-search",
    placeholder: "Search name, area, phone, notes…",
    value: state.search,
    on: {
      input: debounce((event) => store.setUI({ search: event.target.value }), 180),
    },
  });

  container.replaceChildren(
    el("div", { class: "sidebar__head" }, [
      search,
      el("div", { class: "sidebar__controls" }, [
        el("select", {
          class: "control control--inline",
          title: "Sort by",
          on: { change: (event) => store.setUI({ sort: event.target.value }) },
        }, store.SORTS.map((sort) => el("option", {
          value: sort.value, text: sort.label, selected: state.sort === sort.value,
        }))),
        el("details", { class: "filter-toggle", open: activeFilters > 0 }, [
          el("summary", { class: "btn btn--small" }, [
            "Filters",
            activeFilters > 0 && el("span", { class: "badge", text: String(activeFilters) }),
          ]),
          filterPanel(),
        ]),
      ]),
      el("div", { class: "sidebar__count" }, [
        el("span", { text: `${points.length} of ${state.points.length} shown` }),
        getViewportIds && el("label", { class: "mini-field mini-field--check" }, [
          el("input", {
            type: "checkbox",
            checked: viewportOnly,
            on: { change: (event) => store.setUI({ viewportOnly: event.target.checked }) },
          }),
          "on screen only",
        ]),
      ]),
    ]),

    points.length
      ? el("div", { class: "cards" }, points.map((point) => card(point, {
        settings,
        selectedId: state.selectedId,
        compareIds: state.compareIds,
        onSelect: onSelect || store.select,
      })))
      : el("div", { class: "empty" }, [
        el("p", { text: state.points.length ? "Nothing matches those filters." : "No locations yet." }),
        el("p", {
          class: "muted",
          text: state.points.length
            ? "Clear a filter, or widen the budget slider."
            : "Click anywhere on the map to drop your first pin.",
        }),
        state.points.length > 0 && el("button", {
          class: "btn btn--small", type: "button", text: "Clear filters",
          on: { click: () => store.resetFilters() },
        }),
      ]),
  );

  return container;
}
