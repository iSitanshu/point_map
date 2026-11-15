/**
 * Example locations loaded on first run, so the app is never an empty grey map.
 *
 * All Mumbai, because that is where the search is. Every one carries
 * `demo: true`, so Money → Your data → "Remove the example places" clears them
 * in one tap once you have your own.
 *
 * The three PGs are the worked comparison from docs/data-model.md, because they
 * demonstrate the whole point of the app: on cash Mira Road is cheapest, price
 * your commute time and Andheri wins, and the day-one cash figures disagree
 * with both.
 *
 * Coordinates are approximate neighbourhood positions, not surveyed. Open a pin
 * and use "Move pin" to correct one.
 */

export const SEED_SETTINGS = {
  budgetMonthly: 20000,
  stayMonths: 12,
  foodEstimate: 6000,
  commuteDays: 22,
  workPin: { lat: 19.0662, lng: 72.8691, label: "Work — BKC" },
};

export const SEED_POINTS = [
  {
    demo: true,
    name: "Sai Krupa PG",
    kind: "pg",
    status: "shortlist",
    lat: 19.1136,
    lng: 72.8697,
    area: "Andheri East",
    landmark: "5 min from Chakala Metro",
    address: "Near Chakala Metro Station, Andheri East, Mumbai 400099",
    contact: { person: "Rahul (broker)", phone: "9876543210", source: "broker" },
    room: { sharing: 3, gender: "male", furnished: "fully furnished", floor: "2nd", attachedBath: true, lift: false },
    food: { included: true, meals: "Breakfast + dinner", vegOnly: true },
    costs: {
      rent: 15000, deposit: 30000, brokerage: 15000, utilities: 800,
      commuteMonthly: 1540, setupCost: 4000, advanceMonths: 1,
      lockInMonths: 3, noticeMonths: 1, dueDay: 5, askingRent: 16000,
      depositRefundable: true,
    },
    amenities: ["wifi", "washing machine", "power backup", "cupboard"],
    rules: { gateClosing: "11:30pm", guests: "Not in rooms", cooking: "No" },
    ratings: { safety: 4, cleanliness: 4, foodQuality: 3, water: 4, landlord: 4, signal: 5 },
    commute: { minutesToWork: 25, nearestStation: "Andheri", stationWalkMin: 12 },
    visit: {
      date: "2026-11-08",
      done: true,
      checklist: {
        "water-pressure": { checked: true, note: "Good on the 2nd floor" },
        signal: { checked: true, note: "" },
        window: { checked: true, note: "Faces the lane, not a shaft" },
        plugs: { checked: false, note: "One socket, shared. Need an extension board." },
        "night-noise": { checked: false, note: "Metro audible until midnight" },
      },
    },
    notes: "Example place — remove these once you add your own.\n\n"
      + "Negotiated down from ₹16,000. Food is decent, ate dinner there during the visit.",
    tags: ["example"],
    lastVerifiedAt: "2026-11-12",
  },
  {
    demo: true,
    name: "Royal Stay — single room",
    kind: "pg",
    status: "visited",
    lat: 19.1176,
    lng: 72.906,
    area: "Powai",
    landmark: "Behind Hiranandani market",
    contact: { person: "Mrs. Nair (owner)", phone: "9123456780", source: "owner" },
    room: {
      sharing: 1, gender: "any", furnished: "semi-furnished", floor: "4th",
      attachedBath: true, ac: true, balcony: true, lift: true,
    },
    food: { included: false, kitchenAccess: true },
    costs: {
      rent: 26000, deposit: 52000, brokerage: 0, utilities: 3000,
      commuteMonthly: 2640, setupCost: 6000, advanceMonths: 1,
      lockInMonths: 6, noticeMonths: 1, dueDay: 1, depositRefundable: true,
    },
    amenities: ["wifi", "fridge", "lift", "parking", "geyser", "cctv"],
    ratings: { safety: 5, cleanliness: 5, water: 5, landlord: 4, signal: 4 },
    commute: { minutesToWork: 40, nearestStation: "Kanjurmarg", stationWalkMin: 20 },
    notes: "Example place. Own kitchen and no brokerage, but ₹84,000 on day one "
      + "and a 6-month lock-in — leaving in month 3 would cost about ₹1,04,000.",
    tags: ["example"],
    lastVerifiedAt: "2026-11-10",
  },
  {
    demo: true,
    name: "Shree PG",
    kind: "pg",
    status: "toVisit",
    lat: 19.2952,
    lng: 72.8544,
    area: "Mira Road",
    landmark: "10 min walk east of the station",
    contact: { person: "Imran (broker)", phone: "9988776655", source: "broker" },
    room: { sharing: 2, gender: "male", furnished: "fully furnished" },
    food: { included: true, meals: "All three" },
    costs: {
      rent: 9500, deposit: 19000, brokerage: 9500, utilities: 1000,
      commuteMonthly: 3400, setupCost: 3500, advanceMonths: 1, dueDay: 7,
    },
    amenities: ["wifi", "washing machine"],
    commute: { minutesToWork: 75, nearestStation: "Mira Road", stationWalkMin: 10 },
    notes: "Example place. Cheapest on paper — but 75 minutes each way. "
      + "Set \"your time, per hour\" in Money to see what that is really worth.",
    tags: ["example"],
    lastVerifiedAt: "2026-11-13",
  },
  {
    demo: true,
    name: "Blue Nest PG",
    kind: "pg",
    status: "rejected",
    lat: 19.0896,
    lng: 72.8656,
    area: "Vile Parle East",
    contact: { person: "Listing on a site", source: "listing site" },
    room: { sharing: 4, gender: "male" },
    food: { included: false },
    costs: { rent: 11000, deposit: 44000, brokerage: 11000, utilities: 1500, commuteMonthly: 1200 },
    rejectedReason: "Four to a room with one bathroom, and the deposit is four months' rent "
      + "with refund 'conditions' the manager wouldn't put in writing.",
    notes: "Example of a rejected place. Rejected pins are hidden but never deleted — "
      + "the reason is the most useful note you will write.",
    tags: ["example"],
    lastVerifiedAt: "2026-10-28",
  },
  {
    demo: true,
    name: "Work — BKC",
    kind: "office",
    status: "current",
    lat: 19.0662,
    lng: 72.8691,
    area: "Bandra Kurla Complex",
    notes: "Example. Set your real workplace in Money → Your numbers → Work location. "
      + "It drives the distance column and the commute-time comparison.",
    tags: ["example"],
  },
];
