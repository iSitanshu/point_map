/**
 * Tests for the cost engine.
 *
 * Run with `npm test`, or `node tests/money.test.mjs`. No test runner and no
 * dependencies — plain node:assert, in keeping with ADR-0003.
 *
 * The three worked options below are the same ones in docs/data-model.md §4 and
 * docs/brainstorm.md §2. If a number here changes, that documentation is wrong
 * and must be updated with it — these assertions are what keep the two honest.
 */

import assert from "node:assert/strict";
import {
  tmcBreakdown, cashDayOneBreakdown, timeAdjustedTMC, adjustedTMC,
  netCostOfStay, exitCost, ledgerSummary, depositHaircutMonthly,
  utilitiesEffective, foodMonthly, commuteHoursMonthly, budgetDelta,
} from "../app/lib/money.js";
import { newPoint, DEFAULT_SETTINGS } from "../app/model.js";

let passed = 0;
const check = (label, fn) => {
  try {
    fn();
    passed += 1;
  } catch (err) {
    console.error(`✗ ${label}\n  ${err.message}`);
    process.exitCode = 1;
  }
};

const settings = { ...DEFAULT_SETTINGS, foodEstimate: 6000, stayMonths: 12, commuteDays: 22, budgetMonthly: 20000 };
const round = (value) => (value === null ? null : Math.round(value));

/* ------------------------------------------------- the three real options -- */

const andheri = newPoint({
  name: "Sai Krupa, Andheri East",
  room: { sharing: 3 },
  food: { included: true },
  costs: {
    rent: 15000, deposit: 30000, brokerage: 15000, utilities: 800,
    commuteMonthly: 1540, setupCost: 4000, advanceMonths: 1,
    lockInMonths: 3, noticeMonths: 1, depositRefundable: true,
    utilitiesBreakdown: {},
  },
  commute: { minutesToWork: 25 },
});

const powai = newPoint({
  name: "Royal Stay, Powai",
  room: { sharing: 1 },
  food: { included: false },
  costs: {
    rent: 26000, deposit: 52000, brokerage: 0, utilities: 3000,
    commuteMonthly: 2640, setupCost: 6000, advanceMonths: 1,
    lockInMonths: 6, noticeMonths: 1, depositRefundable: true,
    utilitiesBreakdown: {},
  },
  commute: { minutesToWork: 40 },
});

const miraRoad = newPoint({
  name: "Shree PG, Mira Road",
  room: { sharing: 2 },
  food: { included: true },
  costs: {
    rent: 9500, deposit: 19000, brokerage: 9500, utilities: 1000,
    commuteMonthly: 3400, setupCost: 3500, advanceMonths: 1,
    utilitiesBreakdown: {},
  },
  commute: { minutesToWork: 75 },
});

/* ----------------------------------------------------- headline number one -- */

check("TMC — Andheri (food included) = ₹18,923", () => {
  assert.equal(round(tmcBreakdown(andheri, settings).total), 18923);
});

check("TMC — Powai (food estimated at ₹6,000) = ₹38,140", () => {
  assert.equal(round(tmcBreakdown(powai, settings).total), 38140);
});

check("TMC — Mira Road = ₹14,983", () => {
  assert.equal(round(tmcBreakdown(miraRoad, settings).total), 14983);
});

check("Mira Road looks ₹3,940/month cheaper than Andheri on cash", () => {
  const gap = tmcBreakdown(andheri, settings).total - tmcBreakdown(miraRoad, settings).total;
  assert.equal(round(gap), 3940);
});

/* ----------------------------------------------------- headline number two -- */

check("Day-one cash — Andheri = ₹64,000", () => {
  assert.equal(round(cashDayOneBreakdown(andheri).total), 64000);
});

check("Day-one cash — Powai = ₹84,000", () => {
  assert.equal(round(cashDayOneBreakdown(powai).total), 84000);
});

check("Day-one cash — Mira Road = ₹41,500", () => {
  assert.equal(round(cashDayOneBreakdown(miraRoad).total), 41500);
});

check("advanceMonths = 0 still charges the first month's rent", () => {
  const point = newPoint({ costs: { rent: 10000, deposit: 20000, advanceMonths: 0, utilitiesBreakdown: {} } });
  assert.equal(round(cashDayOneBreakdown(point).total), 30000);
});

check("advanceMonths = 2 charges two months upfront", () => {
  const point = newPoint({ costs: { rent: 10000, deposit: 20000, advanceMonths: 2, utilitiesBreakdown: {} } });
  assert.equal(round(cashDayOneBreakdown(point).total), 40000);
});

/* ------------------------------------------------- the lens that flips it --- */

check("commute hours — 25 min each way over 22 days = 18.3 h", () => {
  assert.equal(Math.round(commuteHoursMonthly(andheri, settings) * 10) / 10, 18.3);
});

check("at ₹150/hr Andheri (₹21,673) beats Mira Road (₹23,233) — the winner flips", () => {
  const timed = { ...settings, timeValuePerHour: 150 };
  const a = round(timeAdjustedTMC(andheri, timed));
  const c = round(timeAdjustedTMC(miraRoad, timed));
  assert.equal(a, 21673);
  assert.equal(c, 23233);
  assert.ok(a < c, "pricing commute time should reverse the ranking");
});

check("privacy premium credits a single room only", () => {
  const withPremium = { ...settings, privacyPremium: 6000 };
  assert.equal(round(adjustedTMC(powai, withPremium)), 38140 - 6000);
  assert.equal(round(adjustedTMC(andheri, withPremium)), 18923, "3-sharing gets no credit");
});

/* ------------------------------------------------ unknown is never zero ---- */

check("no rent → no headline number, not ₹0", () => {
  const blank = newPoint({ costs: { utilitiesBreakdown: {} } });
  const breakdown = tmcBreakdown(blank, settings);
  assert.equal(breakdown.total, null);
  assert.equal(breakdown.low, null);
  assert.equal(breakdown.sortValue, null);
});

check("missing inputs are counted and produce a range, not a total", () => {
  const partial = newPoint({ costs: { rent: 12000, utilitiesBreakdown: {} } });
  const breakdown = tmcBreakdown(partial, settings);
  assert.equal(breakdown.total, null, "incomplete data must not report an exact figure");
  assert.ok(breakdown.high > breakdown.low, "the range must have width");
  assert.ok(breakdown.missing.includes("utilities"));
  assert.ok(breakdown.missing.includes("food"));
  assert.equal(breakdown.known + breakdown.missing.length, 7);
});

check("a fully specified point reports 7 of 7 known", () => {
  assert.equal(tmcBreakdown(andheri, settings).known, 7);
  assert.deepEqual(tmcBreakdown(andheri, settings).missing, []);
});

check("unanswered food is not treated as 'included'", () => {
  const unknownFood = newPoint({ costs: { rent: 10000, utilities: 500, commuteMonthly: 0, brokerage: 0, deposit: 0, utilitiesBreakdown: {} } });
  assert.equal(foodMonthly(unknownFood, settings).value, null);
  assert.ok(tmcBreakdown(unknownFood, settings).missing.includes("food"));
});

/* ------------------------------------------------------------- utilities --- */

check("an itemised breakdown overrides the single estimate", () => {
  const point = newPoint({
    costs: { utilities: 800, utilitiesBreakdown: { electricity: 600, water: 200, wifi: 400 } },
  });
  const result = utilitiesEffective(point);
  assert.equal(result.value, 1200);
  assert.equal(result.source, "breakdown");
});

check("an empty breakdown falls back to the single estimate", () => {
  const point = newPoint({ costs: { utilities: 800, utilitiesBreakdown: {} } });
  assert.equal(utilitiesEffective(point).value, 800);
});

/* ------------------------------------------------------- deposit handling -- */

check("deposit haircut of 25% on ₹52,000 over 12 months = ₹1,083/month", () => {
  const haircut = { ...settings, depositHaircutPercent: 25 };
  assert.equal(round(depositHaircutMonthly(powai, haircut)), 1083);
});

check("the haircut enters TMC and can change a decision", () => {
  const haircut = { ...settings, depositHaircutPercent: 25 };
  const base = tmcBreakdown(powai, settings).total;
  const adjusted = tmcBreakdown(powai, haircut).total;
  assert.equal(round(adjusted - base), 1083);
});

check("deposit opportunity cost stays OUT of the headline figure", () => {
  const withRate = { ...settings, depositRate: 7 };
  assert.equal(
    round(tmcBreakdown(powai, withRate).total),
    round(tmcBreakdown(powai, { ...settings, depositRate: 0 }).total),
  );
});

/* --------------------------------------------------------- totals and risk -- */

check("net cost of a 12-month stay nets off a refundable deposit", () => {
  // recurring 17,340 × 12 = 208,080  + brokerage 15,000 + setup 4,000 + deposit 30,000
  // = 257,080, less the 30,000 that comes back.
  assert.equal(round(netCostOfStay(andheri, settings)), 227080);
});

check("a non-refundable deposit is not netted off", () => {
  const point = { ...powai, costs: { ...powai.costs, depositRefundable: false } };
  assert.ok(netCostOfStay(point, settings) > netCostOfStay(powai, settings));
});

check("exit cost — leaving Powai in month 3 of a 6-month lock-in", () => {
  const risk = exitCost(powai, 3, settings);
  assert.equal(risk.unserved, 3);
  assert.equal(round(risk.total), 104000); // 3 unserved months + 1 month notice
});

check("exit cost is zero once the lock-in is served", () => {
  const risk = exitCost(miraRoad, 12, settings);
  assert.equal(round(risk.total), 0);
});

check("budget delta is negative when under budget", () => {
  assert.ok(budgetDelta(miraRoad, settings) < 0);
  assert.ok(budgetDelta(powai, settings) > 0);
});

/* ------------------------------------------------------------------ ledger -- */

check("a bill split three ways leaves two thirds owed to me", () => {
  const point = newPoint({
    ledger: [{ id: "a", date: "2026-11-05", category: "electricity", amount: 1800, status: "paid", splitN: 3 }],
  });
  const summary = ledgerSummary([point], settings);
  assert.equal(round(summary.owedToMe), 1200);
  assert.equal(summary.paidTotal, 1800);
});

check("due and paid rows are totalled separately", () => {
  const point = newPoint({
    ledger: [
      { id: "a", date: "2026-11-05", category: "rent", amount: 15000, status: "paid", splitN: 1 },
      { id: "b", date: "2026-12-05", category: "rent", amount: 15000, status: "due", splitN: 1 },
    ],
  });
  const summary = ledgerSummary([point], settings);
  assert.equal(summary.paidTotal, 15000);
  assert.equal(summary.dueTotal, 15000);
  assert.equal(summary.months.length, 2);
});

check("months carry a budget to compare actuals against", () => {
  const current = { ...andheri, status: "current", ledger: [
    { id: "a", date: "2026-11-05", category: "rent", amount: 19000, status: "paid", splitN: 1 },
  ] };
  const summary = ledgerSummary([current], settings);
  assert.equal(round(summary.monthlyBudget), 18923);
  assert.equal(round(summary.months[0].delta), 77); // ₹77 over the true monthly cost
});

console.log(`✓ ${passed} money assertions passed`);
