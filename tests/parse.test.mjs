/**
 * Tests for the WhatsApp paste parser and the small shared helpers.
 *
 * The parser's job is to propose, never to decide — so these assertions check
 * that realistic broker messages yield the right *suggestions*, and that the
 * ambiguous cases fail quietly rather than inventing a number.
 *
 * Run with `node tests/parse.test.mjs`.
 */

import assert from "node:assert/strict";
import { parseAmount, parseListingText } from "../app/lib/parse-whatsapp.js";
import { parseCoords, haversineKm, compactINR, formatINR, num, whatsappLink, addMonths } from "../app/lib/util.js";

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

const valueFor = (parsed, path) => parsed.fields.find((field) => field.path === path)?.value;

/* --------------------------------------------------------------- amounts -- */

check("amounts in every shape a listing uses", () => {
  assert.equal(parseAmount("15,000"), 15000);
  assert.equal(parseAmount("15k"), 15000);
  assert.equal(parseAmount("15 K"), 15000);
  assert.equal(parseAmount("₹15000"), 15000);
  assert.equal(parseAmount("rs 9,500"), 9500);
  assert.equal(parseAmount("1.5L"), 150000);
  assert.equal(parseAmount("1.5 lakh"), 150000);
});

check("a bare small number means thousands, as it does in speech", () => {
  assert.equal(parseAmount("15"), 15000);
  assert.equal(parseAmount("9.5"), 9500);
});

check("nothing in, nothing out", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("call me"), null);
  assert.equal(parseAmount(null), null);
});

/* ------------------------------------------------- a real broker message -- */

const message = `Sai Krupa PG Andheri East
3 sharing with food
Rent 15k per month
Deposit 30000
Brokerage 1 month
Boys only
Wifi, washing machine, power backup
Contact 9876543210`;

check("the whole message is read correctly", () => {
  const parsed = parseListingText(message);
  assert.equal(valueFor(parsed, "costs.rent"), 15000);
  assert.equal(valueFor(parsed, "costs.deposit"), 30000);
  assert.equal(valueFor(parsed, "room.sharing"), 3);
  assert.equal(valueFor(parsed, "food.included"), true);
  assert.equal(valueFor(parsed, "contact.phone"), "9876543210");
  assert.equal(valueFor(parsed, "room.gender"), "male");
  assert.equal(valueFor(parsed, "area"), "Andheri East");
});

check("'brokerage 1 month' is one month's RENT, not one rupee", () => {
  const parsed = parseListingText(message);
  assert.equal(valueFor(parsed, "costs.brokerage"), 15000);
});

check("'2 months deposit' works in the other word order too", () => {
  const parsed = parseListingText("Rent 12000, 2 months deposit, Powai");
  assert.equal(valueFor(parsed, "costs.deposit"), 24000);
});

check("amenities are picked up from keywords", () => {
  const parsed = parseListingText(message);
  const amenities = valueFor(parsed, "amenities");
  assert.ok(amenities.includes("wifi"));
  assert.ok(amenities.includes("washing machine"));
  assert.ok(amenities.includes("power backup"));
});

check("a name is suggested when the message has one", () => {
  assert.match(parseListingText(message).name, /Sai Krupa PG/);
});

/* ------------------------------------------------------- the edge cases -- */

check("'brokerage free' means zero, not unknown", () => {
  assert.equal(valueFor(parseListingText("Rent 10k, brokerage free, Kurla"), "costs.brokerage"), 0);
  assert.equal(valueFor(parseListingText("Direct owner, no broker. 11000 rent"), "costs.brokerage"), 0);
});

check("'without food' is distinguished from 'with food'", () => {
  assert.equal(valueFor(parseListingText("9500 rent without food"), "food.included"), false);
  assert.equal(valueFor(parseListingText("9500 rent with food"), "food.included"), true);
});

check("food is left unproposed when the message doesn't say", () => {
  assert.equal(valueFor(parseListingText("Rent 9500, Thane, 2 sharing"), "food.included"), undefined);
});

check("single occupancy reads as sharing = 1", () => {
  assert.equal(valueFor(parseListingText("Single room 26000 Powai"), "room.sharing"), 1);
});

check("the longer locality wins over the substring", () => {
  assert.equal(valueFor(parseListingText("PG in Andheri East near metro"), "area"), "Andheri East");
  assert.equal(valueFor(parseListingText("PG in Vile Parle East"), "area"), "Vile Parle East");
});

check("a phone number is not mistaken for a rent", () => {
  const parsed = parseListingText("Call 9876543210 for details. Rent 14000.");
  assert.equal(valueFor(parsed, "costs.rent"), 14000);
});

check("lock-in and notice periods are read", () => {
  const parsed = parseListingText("Rent 15000, 6 months lock-in, 1 month notice");
  assert.equal(valueFor(parsed, "costs.lockInMonths"), 6);
  assert.equal(valueFor(parsed, "costs.noticeMonths"), 1);
});

check("an empty paste proposes nothing at all", () => {
  const parsed = parseListingText("   ");
  assert.equal(parsed.fields.length, 0);
  assert.equal(parsed.name, "");
});

/* ------------------------------------------------------------- helpers --- */

check("coordinates are pulled out of a pasted Google Maps link", () => {
  assert.deepEqual(
    parseCoords("https://www.google.com/maps/@19.1136,72.8697,17z"),
    { lat: 19.1136, lng: 72.8697 },
  );
  assert.deepEqual(parseCoords("19.0760, 72.8777"), { lat: 19.076, lng: 72.8777 });
  assert.equal(parseCoords("not a link"), null);
});

check("impossible coordinates are rejected", () => {
  assert.equal(parseCoords("200.1234, 500.5678"), null);
});

check("distance between Andheri East and BKC is about 5 km", () => {
  const km = haversineKm({ lat: 19.1136, lng: 72.8697 }, { lat: 19.0662, lng: 72.8691 });
  assert.ok(km > 4 && km < 7, `expected 4–7 km, got ${km}`);
});

check("money formats the Indian way", () => {
  assert.equal(formatINR(123456), "₹1,23,456");
  assert.equal(formatINR(null), "—");
  assert.equal(compactINR(15000), "₹15k");
  assert.equal(compactINR(9500), "₹9.5k");
  assert.equal(compactINR(150000), "₹1.5L");
});

check("num() keeps empty distinct from zero", () => {
  assert.equal(num(""), null);
  assert.equal(num(null), null);
  assert.equal(num(undefined), null);
  assert.equal(num(0), 0);
  assert.equal(num("15000"), 15000);
});

check("WhatsApp links get the country code only when it is missing", () => {
  assert.equal(whatsappLink("9876543210"), "https://wa.me/919876543210");
  assert.equal(whatsappLink("+91 98765 43210"), "https://wa.me/919876543210");
  assert.equal(whatsappLink(""), null);
});

check("adding months clamps to the end of a short month", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-05", 2), "2027-01-05");
});

console.log(`✓ ${passed} parser and helper assertions passed`);
