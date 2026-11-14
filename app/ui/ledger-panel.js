/**
 * The payment ledger for one location.
 *
 * Deliberately dumb (ADR-0008): a flat list of amounts with dates and a status.
 * No recurring-transaction engine, no category tree, no settle-up graph. The
 * four behaviours that earned their place are rent rows generated in one click,
 * one-tap "paid", a single "roommates owe me" figure, and a deposit refund that
 * has a date attached to it instead of living in someone's memory.
 */

import { el, formatINR, num, todayISO, monthLabel } from "../lib/util.js";
import { LEDGER_CATEGORIES, LEDGER_STATUSES, ledgerStatusMeta } from "../model.js";
import {
  ledgerSummary, generateRentRows, depositRefundStatus, biggestOverrun,
} from "../lib/money.js";
import { toast, confirmDialog } from "./toast.js";
import * as store from "../store.js";

/* ----------------------------------------------------------------- pieces -- */

const statTile = (label, value, tone) => el("div", { class: ["stat", tone && `stat--${tone}`] }, [
  el("span", { class: "stat__label", text: label }),
  el("strong", { class: "stat__value", text: value }),
]);

function depositTracker(point, repaint) {
  const status = depositRefundStatus(point, store.getSettings());
  if (!status) return null;

  const deposit = formatINR(status.deposit);

  if (status.state === "untracked") {
    return el("div", { class: "deposit-track" }, [
      el("div", {}, [
        el("strong", { text: `Deposit ${deposit}` }),
        el("small", { class: "muted", text: " — not being tracked yet. Deposits are lost by forgetting, not by disagreement." }),
      ]),
      el("button", {
        class: "btn btn--small",
        type: "button",
        text: "Start tracking the refund",
        on: {
          click: () => {
            const expected = new Date();
            expected.setMonth(expected.getMonth() + 1);
            store.addLedgerEntry(point.id, {
              category: "deposit",
              amount: status.deposit,
              status: "refundPending",
              date: expected.toISOString().slice(0, 10),
              note: "Expected refund date — edit if the notice period differs",
            });
            repaint();
          },
        },
      }),
    ]);
  }

  if (status.state === "refunded") {
    const short = status.shortfall > 0;
    return el("div", { class: ["deposit-track", short && "deposit-track--warn"] }, [
      el("div", {}, [
        el("strong", { text: `Deposit refunded — ${formatINR(status.received)} of ${deposit}` }),
        short && el("small", { class: "muted", text: ` · ${formatINR(status.shortfall)} withheld. Log the deductions in the notes.` }),
      ]),
    ]);
  }

  const days = status.daysLeft;
  const overdue = days !== null && days < 0;
  return el("div", { class: ["deposit-track", overdue && "deposit-track--warn"] }, [
    el("div", {}, [
      el("strong", { text: `Deposit ${deposit} pending` }),
      el("small", {
        class: "muted",
        text: days === null ? "" : overdue
          ? ` · overdue by ${Math.abs(days)} days`
          : ` · expected in ${days} days`,
      }),
    ]),
    el("button", {
      class: "btn btn--small",
      type: "button",
      text: "Mark refunded",
      on: {
        click: () => {
          const entry = point.ledger.find((row) => row.category === "deposit" && row.status === "refundPending");
          if (!entry) return;
          store.updateLedgerEntry(point.id, entry.id, { status: "refunded", date: todayISO() });
          toast("Deposit marked refunded — edit the amount if any of it was withheld");
          repaint();
        },
      },
    }),
  ]);
}

function quickAdd(point, repaint) {
  const date = el("input", { class: "control control--inline", type: "date", value: todayISO() });
  const category = el("select", { class: "control control--inline" },
    LEDGER_CATEGORIES.map((value) => el("option", { value, text: value })));
  const amount = el("input", { class: "control control--inline", type: "number", placeholder: "amount", min: 0, step: 50 });
  const split = el("input", {
    class: "control control--inline control--narrow",
    type: "number", min: 1, max: 6, value: 1, title: "Split how many ways?",
  });
  const note = el("input", { class: "control control--inline", type: "text", placeholder: "note (optional)" });

  const submit = () => {
    const value = num(amount.value);
    if (value === null) {
      toast("Enter an amount", { level: "warn" });
      amount.focus();
      return;
    }
    store.addLedgerEntry(point.id, {
      date: date.value || todayISO(),
      category: category.value,
      amount: value,
      splitN: Math.max(num(split.value) ?? 1, 1),
      status: "paid",
      note: note.value,
    });
    amount.value = "";
    note.value = "";
    repaint();
  };

  for (const node of [amount, note]) {
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });
  }

  return el("div", { class: "ledger-add" }, [
    date, category, amount,
    el("label", { class: "ledger-add__split", title: "Split how many ways?" }, ["÷", split]),
    note,
    el("button", { class: "btn btn--small btn--primary", type: "button", text: "Log", on: { click: submit } }),
  ]);
}

function row(point, entry, repaint) {
  const meta = ledgerStatusMeta(entry.status);
  const splitN = Math.max(num(entry.splitN) ?? 1, 1);
  const owed = splitN > 1 ? (num(entry.amount) ?? 0) * ((splitN - 1) / splitN) : 0;

  return el("tr", { class: ["ledger-row", entry.status === "due" && "is-due"] }, [
    el("td", { class: "ledger-row__date", text: entry.date }),
    el("td", { class: "ledger-row__cat", text: entry.category }),
    el("td", { class: "ledger-row__amount" }, [
      formatINR(entry.amount),
      splitN > 1 && el("small", { class: "muted", text: ` ÷${splitN} · ${formatINR(owed)} owed to me` }),
    ]),
    el("td", {}, [
      // One tap is the whole interaction for the common case.
      el("button", {
        class: "status-chip status-chip--small",
        style: { "--status-color": meta.color },
        type: "button",
        title: entry.status === "due" ? "Mark paid" : "Change status",
        text: meta.label,
        on: {
          click: () => {
            const next = entry.status === "due" ? "paid" : entry.status === "paid" ? "due" : entry.status;
            store.updateLedgerEntry(point.id, entry.id, { status: next });
            repaint();
          },
        },
      }),
    ]),
    el("td", { class: "ledger-row__note" }, [
      el("input", {
        class: "ledger-row__note-input",
        value: entry.note || "",
        placeholder: "—",
        on: { change: (event) => store.updateLedgerEntry(point.id, entry.id, { note: event.target.value }) },
      }),
    ]),
    el("td", {}, [
      el("select", {
        class: "control control--tiny",
        title: "Status",
        on: {
          change: (event) => {
            store.updateLedgerEntry(point.id, entry.id, { status: event.target.value });
            repaint();
          },
        },
      }, LEDGER_STATUSES.map((status) => el("option", {
        value: status.value, text: status.label, selected: status.value === entry.status,
      }))),
      el("button", {
        class: "icon-btn", type: "button", text: "✕", title: "Delete this row",
        on: {
          click: () => {
            store.removeLedgerEntry(point.id, entry.id);
            repaint();
          },
        },
      }),
    ]),
  ]);
}

/* ----------------------------------------------------------------- public -- */

export function renderLedgerPanel(point, { onChange } = {}) {
  const panel = el("div", { class: "ledger" });

  const repaint = () => {
    panel.replaceChildren(...build());
    onChange?.();
  };

  async function generate() {
    const rows = generateRentRows(point, store.getSettings(), todayISO());
    if (!rows.length) {
      toast("Set a rent first — there's nothing to generate from", { level: "warn" });
      return;
    }
    const ok = await confirmDialog({
      title: `Create ${rows.length} rent rows?`,
      body: `${formatINR(rows[0].amount)} on day ${new Date(rows[0].date).getDate()} of each month, `
        + `from ${rows[0].date} to ${rows[rows.length - 1].date}. One tap marks each one paid.`,
      confirmLabel: `Create ${rows.length} rows`,
    });
    if (!ok) return;
    store.addLedgerEntries(point.id, rows);
    toast(`${rows.length} rent rows created`);
    repaint();
  }

  function build() {
    const fresh = store.pointById(point.id) || point;
    const summary = ledgerSummary([fresh], store.getSettings());
    const overrun = biggestOverrun(fresh, store.getSettings());

    const stats = el("div", { class: "stat-row" }, [
      statTile("Paid so far", formatINR(summary.paidTotal)),
      summary.dueTotal > 0 && statTile("Still due", formatINR(summary.dueTotal), "warn"),
      summary.owedToMe > 0 && statTile("Roommates owe me", formatINR(summary.owedToMe), "info"),
      summary.refundPending > 0 && statTile("Deposit pending", formatINR(summary.refundPending), "info"),
    ]);

    const byMonth = new Map();
    for (const entry of [...(fresh.ledger || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
      const key = String(entry.date || "").slice(0, 7) || "undated";
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(entry);
    }

    const table = fresh.ledger?.length
      ? el("div", { class: "ledger-months" },
        [...byMonth.entries()].map(([key, entries]) => el("div", { class: "ledger-month" }, [
          el("h4", { class: "ledger-month__title" }, [
            key === "undated" ? "Undated" : monthLabel(key),
            el("span", {
              class: "muted",
              text: ` · ${formatINR(entries.reduce((total, entry) => total + (num(entry.amount) ?? 0), 0))}`,
            }),
          ]),
          el("table", { class: "ledger-table" }, [
            el("tbody", {}, entries.map((entry) => row(fresh, entry, repaint))),
          ]),
        ])))
      : el("p", { class: "muted", text: "Nothing logged yet. Start when you pay the deposit — that is the row you will most want a record of." });

    return [
      stats,
      depositTracker(fresh, repaint),
      overrun && el("p", { class: "ledger-overrun", text: `Biggest overrun this month: ${overrun.category} ${formatINR(overrun.delta)} over the ${formatINR(overrun.budgeted)} you expected.` }),
      quickAdd(fresh, repaint),
      el("div", { class: "ledger-tools" }, [
        el("button", {
          class: "btn btn--small", type: "button",
          text: "Generate rent rows for the whole stay",
          on: { click: generate },
        }),
      ]),
      table,
    ];
  }

  panel.replaceChildren(...build());
  return panel;
}
