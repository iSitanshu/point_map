/**
 * The detail drawer — everything known about one location.
 *
 * Two things here are load-bearing decisions rather than layout:
 *
 *  - Both headline numbers render their own inputs inline, so "why ₹20,700?"
 *    is answered on screen (ADR-0005). No figure appears without its lines.
 *  - Rent, deposit and brokerage are editable in place and move the totals as
 *    you type, because negotiation happens live on a phone call (ADR-0006).
 */

import {
  el, formatINR, compactINR, signedINR, num, relTime, whatsappLink, todayISO, escapeHtml,
} from "../lib/util.js";
import {
  STATUSES, CHECKLIST, RATING_FIELDS, statusMeta, kindMeta, pointTitle, isStale, findField,
} from "../model.js";
import {
  tmcBreakdown, cashDayOneBreakdown, timeAdjustedTMC, adjustedTMC, lensesActive,
  netCostOfStay, exitCost, hasLockInRisk, budgetDelta, distanceFromWork,
  depositOpportunityMonthly, commuteHoursMonthly,
} from "../lib/money.js";
import { renderControl } from "./fields.js";
import { renderMediaPanel } from "./media-panel.js";
import { renderLedgerPanel } from "./ledger-panel.js";
import { openPointForm } from "./form.js";
import { toast } from "./toast.js";
import * as store from "../store.js";

/* ------------------------------------------------------------ money cards -- */

function confidenceDot(known) {
  const level = known >= 6 ? "good" : known >= 4 ? "mid" : "low";
  return el("span", {
    class: ["dot", `dot--${level}`],
    title: `${known} of 7 money inputs filled in`,
  });
}

function lineRow(line) {
  const amount = num(line.amount);
  return el("div", { class: ["mline", line.assumed && "mline--assumed"] }, [
    el("span", { class: "mline__label" }, [
      line.label,
      line.detail && el("small", { class: "mline__detail", text: ` ${line.detail}` }),
    ]),
    el("span", {
      class: "mline__amount",
      text: amount === null ? "not known" : formatINR(Math.round(amount)),
    }),
  ]);
}

function renderTMCCard(point, settings, overrides) {
  const merged = overrides ? { ...point, costs: { ...point.costs, ...overrides } } : point;
  const breakdown = tmcBreakdown(merged, settings);
  const delta = budgetDelta(merged, settings);

  const headline = breakdown.total !== null
    ? formatINR(Math.round(breakdown.total))
    : breakdown.low === null
      ? "—"
      : `${compactINR(breakdown.low)}–${compactINR(breakdown.high)}`;

  return el("div", { class: "mcard mcard--primary" }, [
    el("div", { class: "mcard__head" }, [
      el("span", { class: "mcard__label", text: "True monthly cost" }),
      confidenceDot(breakdown.known),
    ]),
    el("strong", { class: "mcard__value", text: headline }),

    breakdown.missing.length > 0 && el("p", {
      class: "mcard__note",
      text: `${breakdown.known} of 7 inputs known — missing ${breakdown.missing.join(", ")}. `
        + "Shown as a range rather than a guess.",
    }),

    delta !== null && el("p", {
      class: ["mcard__delta", delta > 0 ? "is-over" : "is-under"],
      text: `${signedINR(delta)} vs your ${formatINR(settings.budgetMonthly)} budget`,
    }),

    el("div", { class: "mcard__lines" }, breakdown.lines.map(lineRow)),

    settings.showDepositOpportunity && (() => {
      const opportunity = depositOpportunityMonthly(merged, settings);
      return opportunity === null ? null : el("p", {
        class: "mcard__footnote",
        text: `Footnote: the deposit also costs about ${formatINR(Math.round(opportunity))}/month in forgone interest `
          + `at ${settings.depositRate}%. Deliberately excluded from the figure above — it is too small to change a decision.`,
      });
    })(),
  ]);
}

function renderCashCard(point, overrides) {
  const merged = overrides ? { ...point, costs: { ...point.costs, ...overrides } } : point;
  const breakdown = cashDayOneBreakdown(merged);

  return el("div", { class: "mcard" }, [
    el("div", { class: "mcard__head" }, [
      el("span", { class: "mcard__label", text: "Cash needed on day one" }),
    ]),
    el("strong", {
      class: "mcard__value",
      text: breakdown.total === null ? "—" : formatINR(Math.round(breakdown.total)),
    }),
    el("div", { class: "mcard__lines" }, breakdown.lines.map(lineRow)),
  ]);
}

function renderLenses(point, settings, overrides) {
  if (!lensesActive(settings)) return null;
  const merged = overrides ? { ...point, costs: { ...point.costs, ...overrides } } : point;

  const cash = tmcBreakdown(merged, settings).sortValue;
  const timed = timeAdjustedTMC(merged, settings);
  const adjusted = adjustedTMC(merged, settings);
  const hours = commuteHoursMonthly(merged, settings);

  return el("div", { class: "lenses" }, [
    el("div", { class: "lens" }, [
      el("span", { class: "lens__label", text: "Cash" }),
      el("strong", { text: cash === null ? "—" : formatINR(Math.round(cash)) }),
    ]),
    num(settings.timeValuePerHour) > 0 && el("div", { class: "lens" }, [
      el("span", {
        class: "lens__label",
        text: hours === null ? "+ commute time" : `+ ${Math.round(hours)}h travel @ ₹${settings.timeValuePerHour}/h`,
      }),
      el("strong", { text: timed === null ? "—" : formatINR(Math.round(timed)) }),
    ]),
    num(settings.privacyPremium) > 0 && el("div", { class: "lens" }, [
      el("span", {
        class: "lens__label",
        text: num(point.room?.sharing) === 1
          ? `− ₹${settings.privacyPremium} privacy premium`
          : "no privacy credit (shared)",
      }),
      el("strong", { text: adjusted === null ? "—" : formatINR(Math.round(adjusted)) }),
    ]),
  ]);
}

/**
 * The negotiation scratchpad. Typing here updates the two cards on every
 * keystroke and commits to the store on blur, so a live phone call can be
 * answered with a number instead of "let me work it out".
 */
function renderNegotiation(point, settings, onPreview) {
  const paths = [
    ["costs.rent", "rent"],
    ["costs.deposit", "deposit"],
    ["costs.brokerage", "brokerage"],
    ["costs.advanceMonths", "advanceMonths"],
  ];
  const draft = {};

  const inputs = paths.map(([path, key]) => {
    const field = findField(path) || { path, label: key, type: "money" };
    const control = renderControl(field, point.costs?.[key], (value) => {
      draft[key] = value;
      onPreview({ ...draft });
    });

    const target = control.querySelector("input") || control;
    target.addEventListener("change", (event) => {
      store.setPointField(point.id, path, num(event.target.value));
    });

    return el("label", { class: "negotiate__item" }, [
      el("span", { class: "negotiate__label", text: field.label }),
      control,
    ]);
  });

  const asking = num(point.costs?.askingRent);
  const rent = num(point.costs?.rent);
  const saved = asking !== null && rent !== null ? asking - rent : null;

  return el("div", { class: "negotiate" }, [
    el("div", { class: "negotiate__head" }, [
      el("strong", { text: "Negotiating?" }),
      el("small", { class: "muted", text: " Change these and watch both numbers move." }),
    ]),
    el("div", { class: "negotiate__grid" }, inputs),
    saved !== null && saved !== 0 && el("p", {
      class: "negotiate__saved",
      text: saved > 0
        ? `Down ${formatINR(saved)}/month from the ${formatINR(asking)} first quoted — ${formatINR(saved * 12)} over a year.`
        : `Currently ${formatINR(-saved)} above the ${formatINR(asking)} first quoted.`,
    }),
  ]);
}

/* ------------------------------------------------------------------ pieces -- */

function statusRow(point) {
  return el("div", { class: "status-row" }, STATUSES.map((status) => el("button", {
    class: ["status-chip", point.status === status.value && "is-active"],
    style: { "--status-color": status.color },
    type: "button",
    title: status.hint,
    text: status.label,
    on: { click: () => store.setPointField(point.id, "status", status.value) },
  })));
}

function actionRow(point) {
  const phone = point.contact?.phone;
  const message = `Hi, is the ${point.kind === "pg" ? "PG" : "place"} at ${point.area || point.name} still available?`
    + (num(point.costs?.rent) !== null ? ` (${formatINR(point.costs.rent)}/month)` : "");

  return el("div", { class: "actions" }, [
    phone && el("a", { class: "btn btn--small", href: `tel:${phone}`, text: "📞 Call" }),
    phone && el("a", {
      class: "btn btn--small",
      href: whatsappLink(phone, message),
      target: "_blank",
      rel: "noopener",
      text: "💬 Still available?",
      title: "Opens WhatsApp with the question pre-written — read it before sending",
    }),
    num(point.lat) !== null && el("a", {
      class: "btn btn--small",
      href: `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`,
      target: "_blank",
      rel: "noopener",
      text: "🗺 Directions",
    }),
    el("button", {
      class: "btn btn--small",
      type: "button",
      text: "✓ Confirm still listed",
      title: "Resets the staleness clock without opening the form",
      on: {
        click: () => {
          store.setPointField(point.id, "lastVerifiedAt", todayISO());
          toast("Marked as verified today");
        },
      },
    }),
    point.address && el("button", {
      class: "btn btn--small",
      type: "button",
      text: "📋 Copy address",
      on: {
        click: async () => {
          try {
            await navigator.clipboard.writeText(point.address);
            toast("Address copied");
          } catch {
            toast("Couldn't access the clipboard", { level: "warn" });
          }
        },
      },
    }),
  ]);
}

function factGrid(point, settings) {
  const sharing = num(point.room?.sharing);
  const km = distanceFromWork(point, settings);
  const net = netCostOfStay(point, settings);

  const facts = [
    ["Area", point.area],
    ["Room", sharing === 1 ? "Single" : sharing ? `${sharing}-sharing` : null],
    ["For", point.room?.gender],
    ["Furnishing", point.room?.furnished],
    ["Food", point.food?.included === true ? `Included${point.food.meals ? ` — ${point.food.meals}` : ""}`
      : point.food?.included === false ? "Not included" : null],
    ["To work", num(point.commute?.minutesToWork) !== null ? `${point.commute.minutesToWork} min each way` : null],
    ["From work", km !== null ? `${km} km` : null],
    ["Station", point.commute?.nearestStation
      ? `${point.commute.nearestStation}${num(point.commute.stationWalkMin) !== null ? ` · ${point.commute.stationWalkMin} min walk` : ""}`
      : null],
    ["Gate closes", point.rules?.gateClosing],
    ["Lock-in", num(point.costs?.lockInMonths) ? `${point.costs.lockInMonths} months` : null],
    [`Net cost of ${settings.stayMonths} months`, net !== null ? formatINR(Math.round(net)) : null],
    ["Source", point.contact?.source],
    ["Contact", [point.contact?.person, point.contact?.phone].filter(Boolean).join(" · ")],
  ].filter(([, value]) => value);

  if (!facts.length) return null;

  return el("dl", { class: "facts" }, facts.flatMap(([label, value]) => [
    el("dt", { text: label }),
    el("dd", { text: String(value) }),
  ]));
}

function ratingsRow(point) {
  const filled = RATING_FIELDS.filter((field) => num(point.ratings?.[field.path.split(".")[1]]) !== null);
  if (!filled.length) return null;

  return el("div", { class: "ratings" }, filled.map((field) => {
    const key = field.path.split(".")[1];
    const score = num(point.ratings[key]);
    return el("div", { class: "ratings__item" }, [
      el("span", { class: "ratings__label", text: field.label }),
      el("span", { class: "ratings__stars", text: "★".repeat(score) + "☆".repeat(5 - score) }),
    ]);
  }));
}

function checklistPanel(point) {
  const done = CHECKLIST.filter((item) => point.visit?.checklist?.[item.slug]?.checked).length;

  return el("details", { class: "section", open: done > 0 && done < CHECKLIST.length }, [
    el("summary", { class: "section__head" }, [
      el("span", { text: "Visit checklist" }),
      el("span", { class: "section__count", text: `${done}/${CHECKLIST.length}` }),
    ]),
    el("p", { class: "muted", text: "Same ten questions at every place — the point is comparability, not thoroughness." }),
    el("ul", { class: "checklist" }, CHECKLIST.map((item) => {
      const current = point.visit?.checklist?.[item.slug] || {};
      return el("li", { class: ["checklist__item", current.checked && "is-checked"] }, [
        el("label", { class: "checklist__label" }, [
          el("input", {
            type: "checkbox",
            checked: Boolean(current.checked),
            on: {
              change: (event) => store.setPointField(
                point.id,
                `visit.checklist.${item.slug}`,
                { ...current, checked: event.target.checked },
              ),
            },
          }),
          el("span", { text: item.label }),
        ]),
        el("input", {
          class: "checklist__note",
          placeholder: "note",
          value: current.note || "",
          on: {
            change: (event) => store.setPointField(
              point.id,
              `visit.checklist.${item.slug}`,
              { ...current, note: event.target.value },
            ),
          },
        }),
      ]);
    })),
  ]);
}

function textSection(title, body, { tone } = {}) {
  if (!body) return null;
  return el("div", { class: ["prose", tone && `prose--${tone}`] }, [
    el("h4", { class: "prose__title", text: title }),
    el("p", { class: "prose__body", html: escapeHtml(body).replace(/\n/g, "<br>") }),
  ]);
}

/* ------------------------------------------------------------------ public -- */

export function renderDetail(container, point, { onEdit, onFocus } = {}) {
  const settings = store.getSettings();
  const status = statusMeta(point.status);
  const kind = kindMeta(point.kind);
  const stale = isStale(point, settings);

  /* Live preview while the negotiation inputs are being typed into. */
  const moneySlot = el("div", { class: "money-slot" });
  const paintMoney = (overrides = null) => {
    moneySlot.replaceChildren(
      el("div", { class: "mcards" }, [
        renderTMCCard(point, settings, overrides),
        renderCashCard(point, overrides),
      ]),
      renderLenses(point, settings, overrides),
    );
  };
  paintMoney();

  const risk = hasLockInRisk(point) ? exitCost(point, 3, settings) : null;

  container.replaceChildren(
    el("header", { class: "drawer__head" }, [
      el("div", { class: "drawer__title-row" }, [
        el("span", { class: "drawer__kind", text: kind.icon, title: kind.label }),
        el("h2", { class: "drawer__title", text: pointTitle(point) }),
        el("button", {
          class: "icon-btn icon-btn--close", type: "button", text: "✕",
          title: "Close (Esc)",
          on: { click: () => store.select(null) },
        }),
      ]),
      el("div", { class: "drawer__sub" }, [
        point.area && el("span", { text: point.area }),
        point.landmark && el("span", { class: "muted", text: `· ${point.landmark}` }),
        el("span", {
          class: ["drawer__verified", stale && "is-stale"],
          text: `· verified ${relTime(point.lastVerifiedAt)}`,
          title: stale ? "Older than three weeks — worth re-checking before you plan around it" : "",
        }),
      ]),
      statusRow(point),
      el("div", { class: "drawer__tools" }, [
        el("button", {
          class: "btn btn--small", type: "button", text: "✎ Edit all fields",
          on: { click: () => (onEdit ? onEdit(point) : openPointForm({ pointId: point.id })) },
        }),
        el("button", {
          class: ["btn", "btn--small", store.getState().compareIds.includes(point.id) && "is-active"],
          type: "button",
          text: store.getState().compareIds.includes(point.id) ? "✓ In compare" : "⇄ Compare",
          on: { click: () => store.toggleCompare(point.id) },
        }),
        num(point.lat) !== null && el("button", {
          class: "btn btn--small", type: "button", text: "◎ Centre map",
          on: { click: () => onFocus?.(point) },
        }),
      ]),
    ]),

    moneySlot,

    risk && risk.total > 0 && el("p", { class: "warn-line" }, [
      el("strong", { text: "Exit risk: " }),
      `leaving in month 3 of a ${risk.lockIn}-month lock-in costs about ${formatINR(risk.total)} `
      + `(${risk.unserved} unserved months${risk.notice ? ` + ${risk.notice} month notice` : ""}).`,
    ]),

    renderNegotiation(point, settings, paintMoney),

    actionRow(point),
    factGrid(point, settings),
    ratingsRow(point),

    point.status === "rejected" && textSection("Why this was rejected", point.rejectedReason, { tone: "danger" }),
    textSection("Notes", point.notes),
    textSection("House rules", [point.rules?.guests, point.rules?.cooking, point.rules?.smoking, point.rules?.notes]
      .filter(Boolean).join(" · ")),

    point.amenities?.length && el("div", { class: "chips chips--static" },
      point.amenities.map((amenity) => el("span", { class: "chip", text: amenity }))),

    point.tags?.length && el("div", { class: "chips chips--static chips--muted" },
      point.tags.map((tag) => el("span", { class: "chip", text: `#${tag}` }))),

    point.links?.length && el("ul", { class: "links" }, point.links.map((link) => el("li", {}, [
      el("a", { href: link, target: "_blank", rel: "noopener", text: link }),
    ]))),

    checklistPanel(point),

    el("details", { class: "section", open: Boolean(point.media?.length) }, [
      el("summary", { class: "section__head" }, [
        el("span", { text: "Photos & video" }),
        el("span", { class: "section__count", text: String(point.media?.length || 0) }),
      ]),
      renderMediaPanel(point),
    ]),

    el("details", { class: "section", open: Boolean(point.ledger?.length) }, [
      el("summary", { class: "section__head" }, [
        el("span", { text: "Payments" }),
        el("span", { class: "section__count", text: String(point.ledger?.length || 0) }),
      ]),
      renderLedgerPanel(point),
    ]),
  );

  return container;
}
