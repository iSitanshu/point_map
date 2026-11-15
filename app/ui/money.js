/**
 * The Money view: budget, every option ranked by what it really costs, the
 * payment ledger, and the assumptions that drive all of it.
 *
 * The settings here are not preferences — they are the inputs to the comparison
 * (ADR-0005), so they sit next to the numbers they change rather than behind a
 * gear icon.
 */

import { el, formatINR, compactINR, signedINR, num, monthLabel, relTime } from "../lib/util.js";
import { pointTitle, statusMeta } from "../model.js";
import { tmcBreakdown, tmcSortValue, cashDayOne, ledgerSummary } from "../lib/money.js";
import { renderLedgerPanel } from "./ledger-panel.js";
import { usage, formatBytes, downloadAllLocal } from "../media.js";
import { toast, confirmDialog } from "./toast.js";
import * as store from "../store.js";

/* ---------------------------------------------------------------- settings -- */

function settingNumber({ label, key, min = 0, max = 200000, step = 100, hint, prefix = "₹" }) {
  const settings = store.getSettings();
  return el("label", { class: "setting" }, [
    el("span", { class: "setting__label", text: label }),
    el("span", { class: "setting__input" }, [
      prefix && el("span", { class: "setting__prefix", text: prefix }),
      el("input", {
        class: "control control--inline",
        type: "number",
        value: settings[key] ?? "",
        min,
        max,
        step,
        on: {
          change: (event) => {
            store.updateSettings({ [key]: num(event.target.value) ?? 0 });
          },
        },
      }),
    ]),
    hint && el("small", { class: "setting__hint", text: hint }),
  ]);
}

function assumptionsPanel(onPickWorkPin) {
  const settings = store.getSettings();

  return el("div", { class: "panel" }, [
    el("h3", { class: "panel__title", text: "Your numbers" }),
    el("div", { class: "settings-grid" }, [
      settingNumber({
        label: "Monthly budget", key: "budgetMonthly", step: 500,
        hint: "Everything is shown as over or under this",
      }),
      settingNumber({
        label: "Expected stay", key: "stayMonths", min: 1, max: 60, step: 1, prefix: "",
        hint: "Months. Brokerage and setup are spread over this",
      }),
      settingNumber({
        label: "Food, if not included", key: "foodEstimate", step: 500,
        hint: "One estimate applied to every no-food place, for consistency",
      }),
      settingNumber({
        label: "Travel days / month", key: "commuteDays", min: 0, max: 31, step: 1, prefix: "",
      }),
      settingNumber({
        label: "Your time, per hour", key: "timeValuePerHour", max: 5000, step: 50,
        hint: "0 ignores commute time. ₹150/hr can reverse which place wins",
      }),
      settingNumber({
        label: "Privacy premium", key: "privacyPremium", max: 20000, step: 500,
        hint: "What a single room is worth to you per month",
      }),
      settingNumber({
        label: "Treat as stale after", key: "staleAfterDays", min: 7, max: 120, step: 1, prefix: "",
        hint: "Days. Pins fade past this — Mumbai inventory turns over fast",
      }),
      el("label", { class: "setting" }, [
        el("span", { class: "setting__label", text: "Deposit never returned" }),
        el("select", {
          class: "control control--inline",
          on: { change: (event) => store.updateSettings({ depositHaircutPercent: num(event.target.value) ?? 0 }) },
        }, [0, 10, 25].map((percent) => el("option", {
          value: percent,
          text: `${percent}%`,
          selected: (num(settings.depositHaircutPercent) ?? 0) === percent,
        }))),
        el("small", {
          class: "setting__hint",
          text: "Assume this share of each deposit is lost. 25% of ₹52,000 is ₹1,083/month — enough to change a decision",
        }),
      ]),
      el("label", { class: "setting setting--check" }, [
        el("input", {
          type: "checkbox",
          checked: Boolean(settings.showDepositOpportunity),
          on: { change: (event) => store.updateSettings({ showDepositOpportunity: event.target.checked }) },
        }),
        el("span", {}, [
          "Show the interest forgone on deposits",
          el("small", { class: "setting__hint", text: "A footnote only — never part of the headline figure" }),
        ]),
      ]),
      el("div", { class: "setting" }, [
        el("span", { class: "setting__label", text: "Work location" }),
        el("div", { class: "setting__input" }, [
          el("span", {
            class: "muted",
            text: settings.workPin ? settings.workPin.label || "set" : "not set",
          }),
          el("button", {
            class: "btn btn--small", type: "button",
            text: settings.workPin ? "Move" : "Set from map",
            on: { click: () => onPickWorkPin?.() },
          }),
          settings.workPin && el("button", {
            class: "link-btn", type: "button", text: "clear",
            on: { click: () => store.updateSettings({ workPin: null }) },
          }),
        ]),
        el("small", { class: "setting__hint", text: "Drives distance-from-work and the commute-time lens" }),
      ]),
    ]),
  ]);
}

/* --------------------------------------------------------------- portfolio -- */

function portfolioPanel() {
  const settings = store.getSettings();
  const points = store.getPoints()
    .filter((point) => point.kind === "pg" && point.status !== "rejected")
    .map((point) => ({ point, tmc: tmcSortValue(point, settings) }))
    .sort((a, b) => (a.tmc ?? Infinity) - (b.tmc ?? Infinity));

  if (!points.length) {
    return el("div", { class: "panel" }, [
      el("h3", { class: "panel__title", text: "What each option really costs" }),
      el("p", { class: "muted", text: "Add a PG with a rent and it will appear here, ranked by true monthly cost." }),
    ]);
  }

  const maxValue = Math.max(
    ...points.map(({ tmc }) => tmc ?? 0),
    num(settings.budgetMonthly) ?? 0,
  ) * 1.05;

  const budgetPercent = ((num(settings.budgetMonthly) ?? 0) / maxValue) * 100;

  return el("div", { class: "panel" }, [
    el("h3", { class: "panel__title", text: "What each option really costs" }),

    el("div", { class: "bars" }, [
      el("div", { class: "bars__budget", style: { left: `${budgetPercent}%` } }, [
        el("span", { class: "bars__budget-label", text: `budget ${compactINR(settings.budgetMonthly)}` }),
      ]),

      ...points.map(({ point, tmc }) => {
        const breakdown = tmcBreakdown(point, settings);
        const status = statusMeta(point.status);
        const over = tmc !== null && tmc > (num(settings.budgetMonthly) ?? Infinity);
        const cash = cashDayOne(point);

        return el("button", {
          class: ["bar-row", point.id === store.getState().selectedId && "is-selected"],
          type: "button",
          on: {
            click: () => {
              store.select(point.id);
              store.setUI({ view: "map" });
            },
          },
        }, [
          el("span", { class: "bar-row__name" }, [
            el("span", { class: "bar-row__dot", style: { background: status.color } }),
            pointTitle(point),
          ]),
          el("span", { class: "bar-row__track" }, [
            el("span", {
              class: ["bar-row__fill", over && "is-over"],
              style: { width: `${Math.min(((tmc ?? 0) / maxValue) * 100, 100)}%` },
            }),
            breakdown.total === null && breakdown.high !== null && el("span", {
              class: "bar-row__uncertain",
              style: {
                left: `${((breakdown.low ?? 0) / maxValue) * 100}%`,
                width: `${(((breakdown.high ?? 0) - (breakdown.low ?? 0)) / maxValue) * 100}%`,
              },
              title: `Range because ${breakdown.missing.join(", ")} ${breakdown.missing.length === 1 ? "is" : "are"} unknown`,
            }),
          ]),
          el("span", { class: "bar-row__value" }, [
            el("strong", { text: tmc === null ? "—" : formatINR(Math.round(tmc)) }),
            cash !== null && el("small", { class: "muted", text: ` · ${compactINR(cash)} day one` }),
          ]),
        ]);
      }),
    ]),

    el("p", { class: "muted", text: "Striped sections are ranges — something is still unknown for that place." }),
  ]);
}

/* ------------------------------------------------------------------ ledger -- */

function ledgerPanel() {
  const settings = store.getSettings();
  const points = store.getPoints();
  const summary = ledgerSummary(points, settings);
  const current = points.find((point) => point.status === "current" && point.kind === "pg");

  const tiles = el("div", { class: "stat-row" }, [
    el("div", { class: "stat" }, [
      el("span", { class: "stat__label", text: "Paid so far" }),
      el("strong", { class: "stat__value", text: formatINR(summary.paidTotal) }),
    ]),
    summary.dueTotal > 0 && el("div", { class: "stat stat--warn" }, [
      el("span", { class: "stat__label", text: "Still due" }),
      el("strong", { class: "stat__value", text: formatINR(summary.dueTotal) }),
    ]),
    summary.owedToMe > 0 && el("div", { class: "stat stat--info" }, [
      el("span", { class: "stat__label", text: "Roommates owe me" }),
      el("strong", { class: "stat__value", text: formatINR(summary.owedToMe) }),
    ]),
    summary.refundPending > 0 && el("div", { class: "stat stat--info" }, [
      el("span", { class: "stat__label", text: "Deposit pending" }),
      el("strong", { class: "stat__value", text: formatINR(summary.refundPending) }),
    ]),
  ]);

  const months = summary.months.slice(-12).reverse();

  return el("div", { class: "panel" }, [
    el("h3", { class: "panel__title", text: "Money actually spent" }),
    tiles,

    months.length
      ? el("table", { class: "month-table" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "Month" }),
          el("th", { text: "Paid" }),
          el("th", { text: "vs budget" }),
          el("th", { text: "Biggest line" }),
        ])]),
        el("tbody", {}, months.map((month) => {
          const biggest = Object.entries(month.byCategory)
            .sort((a, b) => b[1] - a[1])[0];
          return el("tr", {}, [
            el("td", { text: monthLabel(month.key) }),
            el("td", { text: formatINR(month.paid) }),
            el("td", {
              class: month.delta === null ? "" : month.delta > 0 ? "is-over" : "is-under",
              text: month.delta === null ? "—" : signedINR(month.delta),
            }),
            el("td", { text: biggest ? `${biggest[0]} ${formatINR(biggest[1])}` : "—" }),
          ]);
        })),
      ])
      : el("p", {
        class: "muted",
        text: "Nothing logged yet. Once you move in, log the deposit first — it is the row you will most want a record of.",
      }),

    current && el("details", { class: "section", open: true }, [
      el("summary", { class: "section__head" }, [
        el("span", { text: `Payments — ${pointTitle(current)}` }),
      ]),
      renderLedgerPanel(current),
    ]),

    !current && el("p", {
      class: "muted",
      text: "Set a place's status to \"Current home\" and its rent ledger appears here.",
    }),
  ]);
}

/* -------------------------------------------------------------------- data -- */

function dataPanel() {
  const backup = store.backupStatus();
  const mediaNote = el("small", { class: "muted" });

  usage().then(({ count, bytes }) => {
    mediaNote.textContent = count
      ? `${count} uploaded file${count === 1 ? "" : "s"} in this browser · ${formatBytes(bytes)}`
      : "No uploaded files — all media is links or files in the media/ folder";
  }).catch(() => {});

  const fileInput = el("input", {
    type: "file",
    accept: "application/json",
    class: "visually-hidden",
    id: "import-json",
    on: {
      change: async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = "";

        const ok = await confirmDialog({
          title: "Replace everything with this file?",
          body: "Import replaces all current locations and settings. Export first if you have unsaved work — "
            + "merging two copies isn't supported yet.",
          confirmLabel: "Replace",
          danger: true,
        });
        if (!ok) return;

        try {
          const count = store.importJSON(await file.text());
          toast(`Imported ${count} locations`);
        } catch (err) {
          toast(err.message || "That file couldn't be read", { level: "error", timeout: 6000 });
        }
      },
    },
  });

  return el("div", { class: "panel" }, [
    el("h3", { class: "panel__title", text: "Your data" }),
    el("p", {
      class: ["backup-line", backup.overdue && "is-warn"],
      text: backup.lastBackupAt
        ? `Last backup ${relTime(backup.lastBackupAt)}${backup.writes ? ` · ${backup.writes} changes since` : ""}.`
        : "Never backed up. Everything lives in this browser only.",
    }),
    el("div", { class: "button-row" }, [
      el("button", {
        class: "btn btn--primary btn--small", type: "button", text: "⤓ Back up to a JSON file",
        on: {
          click: () => {
            const name = store.exportJSON();
            toast(`Saved ${name}`);
          },
        },
      }),
      fileInput,
      el("label", { class: "btn btn--small", for: "import-json", text: "⤒ Import a backup" }),
      el("button", {
        class: "btn btn--small", type: "button", text: "⤓ Export CSV",
        on: { click: () => store.exportCSV() },
      }),
      el("button", {
        class: "btn btn--small", type: "button", text: "⤓ Download uploaded media",
        on: {
          click: async () => {
            const n = await downloadAllLocal();
            toast(n ? `Downloading ${n} files` : "Nothing uploaded in this browser");
          },
        },
      }),
    ]),
    mediaNote,
    el("p", {
      class: "muted",
      text: "Uploaded photos and videos are not inside the JSON backup — download them separately "
        + "if you are moving to another browser or laptop.",
    }),
    store.demoCount() > 0 && el("div", { class: "button-row" }, [
      el("button", {
        class: "btn btn--small",
        type: "button",
        text: `Remove the ${store.demoCount()} example places`,
        on: {
          click: async () => {
            const ok = await confirmDialog({
              title: "Remove the examples?",
              body: "Only the places marked as examples are removed. Anything you added yourself stays.",
              confirmLabel: "Remove examples",
            });
            if (!ok) return;
            store.clearDemoData();
            toast("Examples removed — the map is yours now");
          },
        },
      }),
    ]),

    el("div", { class: "button-row" }, [
      el("button", {
        class: "btn btn--small btn--danger-text", type: "button", text: "Clear all data",
        on: {
          click: async () => {
            const ok = await confirmDialog({
              title: "Delete everything?",
              body: "Every location, note, photo reference and payment row in this browser. "
                + "Export a backup first — this cannot be undone.",
              confirmLabel: "Delete everything",
              danger: true,
            });
            if (!ok) return;
            localStorage.removeItem("point_map.v1");
            location.reload();
          },
        },
      }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ public -- */

export function renderMoney(container, { onPickWorkPin } = {}) {
  const settings = store.getSettings();
  const points = store.getPoints().filter((point) => point.kind === "pg" && point.status !== "rejected");
  const cheapest = points
    .map((point) => ({ point, tmc: tmcSortValue(point, settings) }))
    .filter(({ tmc }) => tmc !== null)
    .sort((a, b) => a.tmc - b.tmc)[0];
  const leastCash = points
    .map((point) => ({ point, cash: cashDayOne(point) }))
    .filter(({ cash }) => cash !== null)
    .sort((a, b) => a.cash - b.cash)[0];

  container.replaceChildren(
    el("div", { class: "view__head" }, [
      el("h2", { text: "Money" }),
      el("p", {
        class: "muted",
        text: "Two numbers decide this: what it costs every month, and what you need on day one. "
          + "They often disagree about which place wins.",
      }),
    ]),

    (cheapest || leastCash) && el("div", { class: "stat-row stat-row--headline" }, [
      cheapest && el("div", { class: "stat stat--good" }, [
        el("span", { class: "stat__label", text: "Cheapest per month" }),
        el("strong", { class: "stat__value", text: formatINR(Math.round(cheapest.tmc)) }),
        el("small", { class: "stat__sub", text: pointTitle(cheapest.point) }),
      ]),
      leastCash && el("div", { class: "stat stat--good" }, [
        el("span", { class: "stat__label", text: "Least cash on day one" }),
        el("strong", { class: "stat__value", text: formatINR(Math.round(leastCash.cash)) }),
        el("small", { class: "stat__sub", text: pointTitle(leastCash.point) }),
      ]),
      cheapest && leastCash && cheapest.point.id !== leastCash.point.id && el("div", { class: "stat stat--info" }, [
        el("span", { class: "stat__label", text: "These disagree" }),
        el("strong", { class: "stat__value", text: "↕" }),
        el("small", {
          class: "stat__sub",
          text: "The cheapest monthly option is not the easiest to move into",
        }),
      ]),
    ]),

    portfolioPanel(),
    assumptionsPanel(onPickWorkPin),
    ledgerPanel(),
    dataPanel(),
  );

  return container;
}
