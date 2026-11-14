/**
 * Every number the app claims about money is computed here and nowhere else,
 * so there is exactly one place to audit when a figure looks wrong.
 *
 * Governing decision: decisions/ADR-0005-money-model.md
 *   - Two headline numbers: trueMonthlyCost() and cashDayOne(). Never one score.
 *   - Seven inputs carry them. Missing input ≠ ₹0; it is tracked and shown.
 *   - Deposit opportunity cost is a footnote, not part of the headline.
 *
 * Every function that returns a figure also returns, or can be paired with, the
 * lines that produced it — the UI renders those inline so "why ₹20,700?" always
 * has an answer on screen.
 */

import { num, haversineKm } from "./util.js";

/**
 * Market norms used ONLY as visible stand-ins for blank fields, to turn a
 * missing input into a range rather than a silent zero. Anything derived from
 * these is badged "assumed" in the UI.
 */
export const NORMS = {
  brokerageMonths: 1, // Mumbai: brokerage is typically one month's rent
  depositMonths: 2, // and deposit typically two
  setupCost: 4000, // mattress, bucket, extension board, lock, hangers
  commuteMonthly: 1500, // train pass + the odd auto
};

export const stayMonths = (point, settings) =>
  num(point?.costs?.stayMonthsOverride) ?? num(settings?.stayMonths) ?? 12;

/** Hook for T-009: once a point can hold several brokers' quotes, the lowest wins. */
export const effectiveRent = (point) => num(point?.costs?.rent);

/**
 * Utilities: one combined estimate, unless the user actually filled in part of
 * the itemised breakdown — in which case their itemisation is better than their
 * estimate and overrides it.
 */
export function utilitiesEffective(point) {
  const breakdown = point?.costs?.utilitiesBreakdown || {};
  const parts = ["electricity", "water", "wifi", "laundry", "maintenance"]
    .map((key) => num(breakdown[key]))
    .filter((value) => value !== null);

  if (parts.length) {
    return { value: parts.reduce((a, b) => a + b, 0), source: "breakdown" };
  }
  const single = num(point?.costs?.utilities);
  return { value: single, source: single === null ? "unknown" : "estimate" };
}

/**
 * Food is the classic unfair comparison: one place includes it, the next
 * doesn't. A single global estimate applied identically everywhere is more
 * useful than a per-place guess, because consistency is what comparison needs.
 */
export function foodMonthly(point, settings) {
  const included = point?.food?.included;
  if (included === true) return { value: 0, source: "included" };

  const actual = num(point?.costs?.foodCostOverride);
  if (actual !== null) return { value: actual, source: "actual" };

  if (included === false) {
    return { value: num(settings?.foodEstimate) ?? 0, source: "estimate" };
  }
  return { value: null, source: "unknown" }; // tri-state: not yet answered
}

/* ------------------------------------------------- headline number 1: TMC -- */

/**
 * The full derivation of true monthly cost, as a list of lines plus totals.
 *
 * Returns:
 *   lines[]      — {key, label, amount, detail, assumed}
 *   total        — exact TMC, or null when a required input is unknown
 *   low / high   — the range when inputs are missing (low treats unknown as 0)
 *   sortValue    — a single number for ordering: exact total, else mid-range
 *   missing[]    — labels of the blank inputs among the seven
 *   known        — how many of the seven are filled in
 */
export function tmcBreakdown(point, settings) {
  const S = stayMonths(point, settings);
  const rent = effectiveRent(point);
  const lines = [];
  const missing = [];
  let assumedExtra = 0;

  /* 1 — rent. No stand-in: without rent there is no number worth showing. */
  lines.push({ key: "rent", label: "Rent", amount: rent, assumed: false });
  if (rent === null) missing.push("rent");

  /* 2 — food, added only when it is not included in the rent. */
  const food = foodMonthly(point, settings);
  if (food.source === "unknown") {
    missing.push("food");
    assumedExtra += num(settings?.foodEstimate) ?? 0;
    lines.push({
      key: "food",
      label: "Food",
      amount: null,
      detail: "not answered yet",
      assumed: false,
    });
  } else if (food.value > 0) {
    lines.push({
      key: "food",
      label: "Food",
      amount: food.value,
      detail: food.source === "estimate" ? "global estimate" : "actual mess cost",
      assumed: food.source === "estimate",
    });
  } else {
    lines.push({ key: "food", label: "Food", amount: 0, detail: "included in rent", assumed: false });
  }

  /* 3 — utilities as one figure. */
  const utilities = utilitiesEffective(point);
  if (utilities.value === null) {
    missing.push("utilities");
    assumedExtra += num(settings?.utilitiesAssumed) ?? 0;
    lines.push({ key: "utilities", label: "Utilities", amount: null, assumed: false });
  } else {
    lines.push({
      key: "utilities",
      label: "Utilities",
      amount: utilities.value,
      detail: utilities.source === "breakdown" ? "itemised" : "estimate",
      assumed: false,
    });
  }

  /* 4 — commute, in cash. Time is a separate lens, see timeAdjusted(). */
  const commute = num(point?.costs?.commuteMonthly);
  if (commute === null) {
    missing.push("commute");
    assumedExtra += NORMS.commuteMonthly;
    lines.push({ key: "commute", label: "Commute", amount: null, assumed: false });
  } else {
    lines.push({ key: "commute", label: "Commute", amount: commute, assumed: false });
  }

  /* 5 — brokerage, spread over the stay. A short stay should be penalised. */
  const brokerage = num(point?.costs?.brokerage);
  if (brokerage === null) {
    missing.push("brokerage");
    if (rent !== null) assumedExtra += (rent * NORMS.brokerageMonths) / S;
    lines.push({ key: "brokerage", label: `Brokerage ÷ ${S}`, amount: null, assumed: false });
  } else if (brokerage > 0) {
    lines.push({
      key: "brokerage",
      label: `Brokerage ÷ ${S}`,
      amount: brokerage / S,
      detail: `₹${Math.round(brokerage).toLocaleString("en-IN")} once`,
      assumed: false,
    });
  }

  /* 6 — one-time setup, likewise spread. Not one of the seven headline inputs,
     so a blank widens the range without counting against the confidence score. */
  const setup = num(point?.costs?.setupCost);
  if (setup === null) {
    assumedExtra += NORMS.setupCost / S;
  } else if (setup > 0) {
    lines.push({
      key: "setup",
      label: `Setup ÷ ${S}`,
      amount: setup / S,
      detail: `₹${Math.round(setup).toLocaleString("en-IN")} once`,
      assumed: false,
    });
  }

  /* 7 — the honest version of "deposit costs me something": a haircut, off by
     default. 25% of ₹52,000 over 12 months is ₹1,083/mo, which can flip a
     decision — unlike opportunity cost, which never does. */
  const haircut = depositHaircutMonthly(point, settings);
  if (haircut !== null && haircut > 0) {
    lines.push({
      key: "haircut",
      label: `Deposit at risk ÷ ${S}`,
      amount: haircut,
      detail: `${settings.depositHaircutPercent}% assumed unrecovered`,
      assumed: true,
    });
  }

  const low = lines.reduce((total, line) => total + (num(line.amount) ?? 0), 0);
  const complete = missing.length === 0;
  const total = rent === null ? null : complete ? low : null;
  const high = rent === null ? null : low + assumedExtra;

  /* Expected stay is the seventh input and always has a value — the global
     setting is a real answer, not a guess — so it never counts as missing. */

  return {
    stay: S,
    lines,
    total,
    low: rent === null ? null : low,
    high,
    sortValue: total ?? (rent === null ? null : (low + (high ?? low)) / 2),
    missing,
    known: 7 - missing.length,
    totalInputs: 7,
  };
}

/** The headline figure alone. Null when rent is unknown. */
export const trueMonthlyCost = (point, settings) => tmcBreakdown(point, settings).total;

/** A single number safe to sort by, even for half-filled records. */
export const tmcSortValue = (point, settings) => tmcBreakdown(point, settings).sortValue;

export function depositHaircutMonthly(point, settings) {
  const percent = num(settings?.depositHaircutPercent) ?? 0;
  const deposit = num(point?.costs?.deposit);
  if (!percent || deposit === null) return null;
  return (deposit * (percent / 100)) / stayMonths(point, settings);
}

/** Footnote only — deliberately kept out of TMC. See ADR-0005. */
export function depositOpportunityMonthly(point, settings) {
  const deposit = num(point?.costs?.deposit);
  const rate = num(settings?.depositRate) ?? 0;
  if (deposit === null || !rate) return null;
  return (deposit * (rate / 100)) / 12;
}

/* ----------------------------------------- headline number 2: day-one cash -- */

/**
 * What has to leave the bank account to move in. Frequently the binding
 * constraint — the cheapest option per month can be the one you cannot afford
 * to start — which is why it is co-headline rather than a detail.
 */
export function cashDayOneBreakdown(point) {
  const rent = effectiveRent(point);
  const deposit = num(point?.costs?.deposit);
  const brokerage = num(point?.costs?.brokerage);
  const setup = num(point?.costs?.setupCost);
  const advanceMonths = Math.max(num(point?.costs?.advanceMonths) ?? 1, 1);

  const lines = [
    { key: "deposit", label: "Deposit", amount: deposit, assumed: false },
    { key: "brokerage", label: "Brokerage", amount: brokerage, assumed: false },
    { key: "setup", label: "Setup", amount: setup, assumed: false },
    {
      key: "advance",
      label: advanceMonths > 1 ? `Advance rent × ${advanceMonths}` : "First month's rent",
      amount: rent === null ? null : rent * advanceMonths,
      assumed: false,
    },
  ];

  const known = lines.filter((line) => num(line.amount) !== null);
  const total = known.length ? known.reduce((sum, line) => sum + num(line.amount), 0) : null;
  const missing = lines.filter((line) => num(line.amount) === null).map((line) => line.key);

  return { lines, total, missing };
}

export const cashDayOne = (point) => cashDayOneBreakdown(point).total;

/* ------------------------------------------------------------ three lenses -- */

export function commuteHoursMonthly(point, settings) {
  const minutes = num(point?.commute?.minutesToWork);
  if (minutes === null) return null;
  const days = num(settings?.commuteDays) ?? 22;
  return (minutes * 2 * days) / 60;
}

/** Lens 2: TMC with commute time priced at the user's own ₹/hour. */
export function timeAdjustedTMC(point, settings) {
  const base = tmcSortValue(point, settings);
  if (base === null) return null;
  const rate = num(settings?.timeValuePerHour) ?? 0;
  const hours = commuteHoursMonthly(point, settings);
  if (!rate || hours === null) return base;
  return base + hours * rate;
}

/** Lens 3: credits a single room by the premium the user says privacy is worth. */
export function adjustedTMC(point, settings) {
  const base = timeAdjustedTMC(point, settings);
  if (base === null) return null;
  const premium = num(settings?.privacyPremium) ?? 0;
  const isSingle = num(point?.room?.sharing) === 1;
  return isSingle ? base - premium : base;
}

export const lensesActive = (settings) =>
  Boolean(num(settings?.timeValuePerHour) || num(settings?.privacyPremium));

/* ------------------------------------------------------- totals and risks -- */

export function totalOutlay(point, settings) {
  const S = stayMonths(point, settings);
  const breakdown = tmcBreakdown(point, settings);
  if (breakdown.low === null) return null;

  const recurring = breakdown.lines
    .filter((line) => ["rent", "food", "utilities", "commute"].includes(line.key))
    .reduce((sum, line) => sum + (num(line.amount) ?? 0), 0);

  const once = (num(point?.costs?.brokerage) ?? 0)
    + (num(point?.costs?.setupCost) ?? 0)
    + (num(point?.costs?.deposit) ?? 0);

  return recurring * S + once;
}

/** Total outlay less whatever the deposit actually gives back. */
export function netCostOfStay(point, settings) {
  const outlay = totalOutlay(point, settings);
  if (outlay === null) return null;
  const deposit = num(point?.costs?.deposit) ?? 0;
  if (point?.costs?.depositRefundable === false) return outlay;
  const haircut = (num(settings?.depositHaircutPercent) ?? 0) / 100;
  return outlay - deposit * (1 - haircut);
}

/** What leaving early costs. Shown only where lock-in is long enough to matter. */
export function exitCost(point, monthsStayed, settings) {
  const rent = effectiveRent(point);
  if (rent === null) return null;
  const lockIn = num(point?.costs?.lockInMonths) ?? 0;
  const notice = num(point?.costs?.noticeMonths) ?? 0;
  const unserved = Math.max(0, lockIn - (num(monthsStayed) ?? 0));
  const total = unserved * rent + notice * rent;
  return { total, unserved, notice, lockIn };
}

export const hasLockInRisk = (point) => (num(point?.costs?.lockInMonths) ?? 0) > 3;

export function budgetDelta(point, settings) {
  const tmc = tmcSortValue(point, settings);
  const budget = num(settings?.budgetMonthly);
  if (tmc === null || budget === null) return null;
  return tmc - budget;
}

export function distanceFromWork(point, settings) {
  const work = settings?.workPin;
  if (!work || num(point?.lat) === null) return null;
  return haversineKm({ lat: point.lat, lng: point.lng }, { lat: work.lat, lng: work.lng });
}

/* ------------------------------------------------------------- the ledger -- */

/**
 * Deliberately dumb aggregation over a flat list of payments (ADR-0008).
 * No double-entry, no category tree — the four totals below are what the user
 * actually asks for, plus a per-month roll-up for budget vs actual.
 */
export function ledgerSummary(points, settings) {
  const rows = [];
  for (const point of points) {
    for (const entry of point.ledger || []) {
      rows.push({ ...entry, pointId: point.id, pointName: point.name });
    }
  }

  const sumWhere = (predicate) => rows
    .filter(predicate)
    .reduce((total, row) => total + (num(row.amount) ?? 0), 0);

  const paidTotal = sumWhere((row) => row.status === "paid");
  const dueTotal = sumWhere((row) => row.status === "due");
  const refundPending = sumWhere((row) => row.status === "refundPending");

  /* A split row means the user paid the whole bill and is owed the rest back. */
  const owedToMe = rows
    .filter((row) => (num(row.splitN) ?? 1) > 1 && row.status !== "owedToMe")
    .reduce((total, row) => {
      const amount = num(row.amount) ?? 0;
      const n = num(row.splitN) ?? 1;
      return total + amount * ((n - 1) / n);
    }, 0)
    + sumWhere((row) => row.status === "owedToMe");

  const byMonth = {};
  for (const row of rows) {
    const key = String(row.date || "").slice(0, 7);
    if (!key) continue;
    byMonth[key] ??= { key, paid: 0, due: 0, byCategory: {} };
    const amount = num(row.amount) ?? 0;
    if (row.status === "paid") byMonth[key].paid += amount;
    if (row.status === "due") byMonth[key].due += amount;
    byMonth[key].byCategory[row.category] = (byMonth[key].byCategory[row.category] ?? 0) + amount;
  }

  const current = points.find((point) => point.status === "current");
  const monthlyBudget = current ? tmcSortValue(current, settings) : num(settings?.budgetMonthly);

  const months = Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key));
  for (const month of months) {
    month.budget = monthlyBudget;
    month.delta = monthlyBudget === null ? null : month.paid - monthlyBudget;
  }

  return { rows, paidTotal, dueTotal, refundPending, owedToMe, months, monthlyBudget };
}

/** "electricity +₹900" — the one analytic worth showing. */
export function biggestOverrun(point, settings) {
  const summary = ledgerSummary([point], settings);
  const latest = summary.months[summary.months.length - 1];
  if (!latest) return null;

  const expected = {
    rent: effectiveRent(point),
    electricity: num(point?.costs?.utilitiesBreakdown?.electricity),
    water: num(point?.costs?.utilitiesBreakdown?.water),
    wifi: num(point?.costs?.utilitiesBreakdown?.wifi),
    food: foodMonthly(point, settings).value,
  };

  let worst = null;
  for (const [category, actual] of Object.entries(latest.byCategory)) {
    const budgeted = expected[category];
    if (budgeted === null || budgeted === undefined) continue;
    const delta = actual - budgeted;
    if (delta > 0 && (!worst || delta > worst.delta)) worst = { category, delta, actual, budgeted };
  }
  return worst;
}

/**
 * Rent rows for the whole stay, generated on demand rather than automatically —
 * a user who prefers logging payments as they happen should not be handed
 * twelve rows of clutter.
 */
export function generateRentRows(point, settings, startDate) {
  const rent = effectiveRent(point);
  if (rent === null) return [];
  const S = stayMonths(point, settings);
  const dueDay = Math.min(Math.max(num(point?.costs?.dueDay) ?? 5, 1), 28);
  const start = new Date(startDate || new Date());

  return Array.from({ length: S }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, dueDay);
    return {
      date: date.toISOString().slice(0, 10),
      category: "rent",
      amount: rent,
      status: "due",
      note: `Rent month ${index + 1} of ${S}`,
    };
  });
}

/** Deposit refund: when it is expected back, and how overdue it is. */
export function depositRefundStatus(point, settings) {
  const deposit = num(point?.costs?.deposit);
  if (deposit === null || point?.costs?.depositRefundable === false) return null;

  const entry = (point.ledger || []).find(
    (row) => row.category === "deposit" && ["refundPending", "refunded"].includes(row.status),
  );
  if (!entry) return { deposit, state: "untracked" };

  if (entry.status === "refunded") {
    const received = num(entry.amount) ?? 0;
    return { deposit, state: "refunded", received, shortfall: deposit - received };
  }

  const expected = entry.date ? new Date(entry.date) : null;
  const daysLeft = expected
    ? Math.round((expected.getTime() - Date.now()) / 86_400_000)
    : null;
  return { deposit, state: "pending", expected: entry.date, daysLeft };
}
