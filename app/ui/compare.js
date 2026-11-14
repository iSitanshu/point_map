/**
 * Side-by-side comparison of 2–4 shortlisted places.
 *
 * Built for one specific moment: a video call with a parent who asks
 * "why ₹20,700?". So every derived figure can be expanded into the lines that
 * produced it, and the assumptions are printed at the bottom rather than hidden
 * in settings (ADR-0005).
 */

import { el, formatINR, compactINR, num, relTime } from "../lib/util.js";
import { statusMeta, pointTitle, RATING_FIELDS } from "../model.js";
import {
  tmcBreakdown, tmcSortValue, cashDayOne, netCostOfStay, timeAdjustedTMC, adjustedTMC,
  distanceFromWork, exitCost, foodMonthly, utilitiesEffective, lensesActive,
} from "../lib/money.js";
import { renderMediaElement } from "../media.js";
import * as store from "../store.js";

const money = (value) => (value === null || value === undefined ? "—" : formatINR(Math.round(value)));
const plain = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));

const ROWS = [
  {
    label: "True monthly cost",
    emphasis: true,
    best: "min",
    get: (point, settings) => tmcSortValue(point, settings),
    render: (point, settings) => {
      const breakdown = tmcBreakdown(point, settings);
      if (breakdown.total !== null) return formatINR(Math.round(breakdown.total));
      if (breakdown.low === null) return "—";
      return `${compactINR(breakdown.low)}–${compactINR(breakdown.high)}`;
    },
  },
  {
    label: "Cash needed on day one",
    emphasis: true,
    best: "min",
    get: (point) => cashDayOne(point),
  },
  {
    label: "Net cost of the whole stay",
    best: "min",
    get: (point, settings) => netCostOfStay(point, settings),
  },
  { label: "Rent", get: (point) => num(point.costs?.rent), best: "min" },
  { label: "Deposit", get: (point) => num(point.costs?.deposit), best: "min" },
  { label: "Brokerage", get: (point) => num(point.costs?.brokerage), best: "min" },
  {
    label: "Utilities",
    get: (point) => utilitiesEffective(point).value,
    best: "min",
  },
  {
    label: "Food",
    get: (point, settings) => foodMonthly(point, settings).value,
    render: (point, settings) => {
      const food = foodMonthly(point, settings);
      if (food.source === "included") return "included in rent";
      if (food.source === "unknown") return "not answered";
      return `${formatINR(food.value)}${food.source === "estimate" ? " (estimated)" : ""}`;
    },
    best: "min",
  },
  { label: "Commute (cash)", get: (point) => num(point.costs?.commuteMonthly), best: "min" },
  {
    label: "Commute (time)",
    get: (point) => num(point.commute?.minutesToWork),
    render: (point) => (num(point.commute?.minutesToWork) === null
      ? "—"
      : `${point.commute.minutesToWork} min each way`),
    best: "min",
  },
  {
    label: "Distance from work",
    get: (point, settings) => distanceFromWork(point, settings),
    render: (point, settings) => {
      const km = distanceFromWork(point, settings);
      return km === null ? "—" : `${km} km`;
    },
    best: "min",
  },
  {
    label: "Room",
    get: (point) => num(point.room?.sharing),
    render: (point) => {
      const sharing = num(point.room?.sharing);
      return sharing === null ? "—" : sharing === 1 ? "Single" : `${sharing}-sharing`;
    },
  },
  { label: "Furnishing", get: (point) => point.room?.furnished, render: (point) => plain(point.room?.furnished) },
  {
    label: "Lock-in",
    get: (point) => num(point.costs?.lockInMonths),
    render: (point) => {
      const lockIn = num(point.costs?.lockInMonths);
      if (!lockIn) return "none";
      const risk = exitCost(point, 3, store.getSettings());
      return `${lockIn} months${risk && risk.total > 0 ? ` · ${compactINR(risk.total)} to leave early` : ""}`;
    },
    best: "min",
  },
  {
    label: "Your ratings",
    get: (point) => {
      const scores = RATING_FIELDS
        .map((field) => num(point.ratings?.[field.path.split(".")[1]]))
        .filter((score) => score !== null);
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    },
    render: (point) => {
      const scores = RATING_FIELDS
        .map((field) => num(point.ratings?.[field.path.split(".")[1]]))
        .filter((score) => score !== null);
      if (!scores.length) return "not rated";
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      return `${average.toFixed(1)} / 5 (${scores.length} rated)`;
    },
    best: "max",
  },
  {
    label: "Visit checklist",
    get: (point) => Object.values(point.visit?.checklist || {}).filter((item) => item.checked).length,
    render: (point) => {
      const done = Object.values(point.visit?.checklist || {}).filter((item) => item.checked).length;
      return done ? `${done} of 10 confirmed` : "not visited";
    },
    best: "max",
  },
  {
    label: "Last verified",
    get: () => null,
    render: (point) => relTime(point.lastVerifiedAt),
  },
  {
    label: "Contact",
    get: () => null,
    render: (point) => [point.contact?.person, point.contact?.phone].filter(Boolean).join(" · ") || "—",
  },
];

function lensRows(settings) {
  if (!lensesActive(settings)) return [];
  const rows = [];
  if (num(settings.timeValuePerHour) > 0) {
    rows.push({
      label: `TMC with commute time @ ₹${settings.timeValuePerHour}/hr`,
      emphasis: true,
      best: "min",
      get: (point) => timeAdjustedTMC(point, settings),
    });
  }
  if (num(settings.privacyPremium) > 0) {
    rows.push({
      label: `…and a ₹${settings.privacyPremium} privacy premium for single rooms`,
      emphasis: true,
      best: "min",
      get: (point) => adjustedTMC(point, settings),
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ public -- */

export function renderCompare(container) {
  const points = store.comparePoints();
  const settings = store.getSettings();

  if (points.length < 2) {
    container.replaceChildren(el("div", { class: "empty empty--view" }, [
      el("h2", { text: "Compare two to four places" }),
      el("p", {
        class: "muted",
        text: "Tick the box on a card in the sidebar, or press ⇄ Compare in a location's drawer. "
          + "Four columns is the limit — beyond that nothing stays readable on a shared screen.",
      }),
      points.length === 1 && el("p", { class: "muted", text: `${pointTitle(points[0])} is selected. Add one more.` }),
    ]));
    return container;
  }

  const rows = [...ROWS.slice(0, 3), ...lensRows(settings), ...ROWS.slice(3)];

  const headerRow = el("tr", {}, [
    el("th", { class: "cmp__corner", text: "" }),
    ...points.map((point) => {
      const status = statusMeta(point.status);
      const photo = (point.media || [])[0];
      return el("th", { class: "cmp__head", style: { "--status-color": status.color } }, [
        photo && el("div", { class: "cmp__photo" }, [renderMediaElement(photo)]),
        el("strong", { class: "cmp__name", text: pointTitle(point) }),
        el("span", { class: "cmp__area", text: point.area || "" }),
        el("span", { class: "cmp__status", text: status.label }),
        el("button", {
          class: "link-btn", type: "button", text: "remove",
          on: { click: () => store.toggleCompare(point.id) },
        }),
      ]);
    }),
  ]);

  const bodyRows = rows.map((row) => {
    const values = points.map((point) => row.get(point, settings));
    const numeric = values.filter((value) => typeof value === "number" && Number.isFinite(value));

    // Only mark a winner when there is a real spread — highlighting a tie or a
    // single known value would imply a conclusion the data does not support.
    let bestValue = null;
    if (row.best && numeric.length > 1 && new Set(numeric).size > 1) {
      bestValue = row.best === "min" ? Math.min(...numeric) : Math.max(...numeric);
    }

    return el("tr", { class: ["cmp__row", row.emphasis && "cmp__row--emphasis"] }, [
      el("th", { class: "cmp__label", text: row.label }),
      ...points.map((point, index) => el("td", {
        class: ["cmp__cell", bestValue !== null && values[index] === bestValue && "is-best"],
        text: row.render ? row.render(point, settings) : money(values[index]),
      })),
    ]);
  });

  /* The derivation, available but not in the way. */
  const workings = el("details", { class: "cmp__workings" }, [
    el("summary", { text: "Show how each monthly cost was worked out" }),
    el("div", { class: "cmp__workings-grid" }, points.map((point) => {
      const breakdown = tmcBreakdown(point, settings);
      return el("div", { class: "cmp__working" }, [
        el("h4", { text: pointTitle(point) }),
        el("div", { class: "mcard__lines" }, breakdown.lines.map((line) => el("div", { class: "mline" }, [
          el("span", { class: "mline__label", text: line.label }),
          el("span", {
            class: "mline__amount",
            text: num(line.amount) === null ? "not known" : formatINR(Math.round(line.amount)),
          }),
        ]))),
        breakdown.missing.length > 0 && el("p", {
          class: "muted",
          text: `Missing: ${breakdown.missing.join(", ")}`,
        }),
      ]);
    })),
  ]);

  container.replaceChildren(
    el("div", { class: "view__head" }, [
      el("h2", { text: `Comparing ${points.length} places` }),
      el("div", { class: "view__actions" }, [
        el("button", {
          class: "btn btn--small", type: "button", text: "⤓ Export these as CSV",
          on: { click: () => store.exportCSV(points) },
        }),
        el("button", {
          class: "btn btn--small", type: "button", text: "Clear comparison",
          on: { click: () => store.setUI({ compareIds: [] }, "compare") },
        }),
      ]),
    ]),

    el("div", { class: "cmp__scroll" }, [
      el("table", { class: "cmp" }, [
        el("thead", {}, [headerRow]),
        el("tbody", {}, bodyRows),
      ]),
    ]),

    workings,

    el("div", { class: "assumptions" }, [
      el("h4", { text: "Assumptions behind these numbers" }),
      el("ul", {}, [
        el("li", { text: `Expected stay: ${settings.stayMonths} months — brokerage and setup costs are spread over it.` }),
        el("li", { text: `Food estimated at ${formatINR(settings.foodEstimate)}/month wherever it is not included, applied identically to every place.` }),
        el("li", {
          text: num(settings.timeValuePerHour) > 0
            ? `Commute time valued at ₹${settings.timeValuePerHour}/hour over ${settings.commuteDays} travel days.`
            : "Commute time is not priced in — only the fare. Set a ₹/hour value in Money settings to see what the travel is worth.",
        }),
        el("li", {
          text: num(settings.depositHaircutPercent) > 0
            ? `${settings.depositHaircutPercent}% of each deposit assumed unrecoverable.`
            : "Deposits assumed fully refundable. The forgone interest on a locked-up deposit is excluded — it is too small to change a decision.",
        }),
        el("li", { text: "Blank fields are treated as unknown, never as zero. A range means something is missing." }),
      ]),
    ]),
  );

  return container;
}
