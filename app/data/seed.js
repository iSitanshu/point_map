/**
 * Example locations loaded on first run, so the app is never an empty grey map.
 *
 * Two of these are the places named in the original brief (Gandhi Park and
 * Dabbu Veg in Rajajipuram, Lucknow) — they are here to show that a park, a
 * mess and a PG live in the same schema with entirely different fields filled
 * in. The rest are Mumbai PGs shaped like the worked example in
 * docs/data-model.md, including one rejection worth keeping.
 *
 * IMPORTANT: the coordinates are approximate, picked to put each pin in the
 * right neighbourhood — not surveyed. Drag any pin to correct it. Delete the
 * lot with Settings → "Clear all data", or set `loadSeedData: false` in
 * app/config.js before the first run.
 */

export const SEED_SETTINGS = {
  budgetMonthly: 20000,
  stayMonths: 12,
  foodEstimate: 6000,
  commuteDays: 22,
  workPin: { lat: 19.0662, lng: 72.8691, label: "Work — BKC" },
};

export const SEED_POINTS = [
  /* ---------------------------------------------- the two from the brief --- */
  {
    name: "Gandhi Park",
    kind: "landmark",
    status: "lead",
    lat: 26.8421,
    lng: 80.8795,
    area: "Rajajipuram, Lucknow",
    landmark: "C Block crossing",
    notes: "Morning walk place. Open 5–9am and 5–9pm, gates locked otherwise. "
      + "Free entry. Useful as the reference point when giving directions to the block.",
    tags: ["reference", "lucknow"],
    ratings: { safety: 4, cleanliness: 3 },
    media: [],
  },
  {
    name: "Dabbu Veg",
    kind: "food",
    status: "lead",
    lat: 26.845,
    lng: 80.883,
    area: "Rajajipuram, Lucknow",
    landmark: "C Block market",
    contact: { person: "Dabbu bhai", phone: "", source: "friend" },
    food: { included: false, vegOnly: true, meals: "Lunch and dinner thali", notes: "Thali ₹80, roti ₹8. Closed Tuesdays." },
    costs: { foodCostOverride: 4800 },
    notes: "Tiffin service available monthly. Ask about the monthly rate before "
      + "committing — the per-thali price works out dearer. "
      + "To attach a video walkthrough: open Photos & video below and paste a "
      + "YouTube or Drive link, or upload straight from your phone.",
    tags: ["mess", "lucknow"],
    ratings: { foodQuality: 4, cleanliness: 3 },
    media: [],
  },

  /* ----------------------------------------------- the Mumbai PG search --- */
  {
    name: "Sai Krupa PG",
    kind: "pg",
    status: "shortlist",
    lat: 19.1136,
    lng: 72.8697,
    area: "Andheri East",
    landmark: "5 min from Chakala Metro",
    address: "Near Chakala Metro Station, Andheri East, Mumbai 400099",
    contact: { person: "Rahul (broker)", phone: "9876543210", source: "broker" },
    room: { sharing: 3, gender: "male", furnished: "fully furnished", floor: "2nd", attachedBath: true, ac: false, lift: false },
    food: { included: true, meals: "Breakfast + dinner", vegOnly: true, kitchenAccess: false },
    costs: {
      rent: 15000, deposit: 30000, brokerage: 15000, utilities: 800,
      commuteMonthly: 1540, setupCost: 4000, advanceMonths: 1,
      lockInMonths: 3, noticeMonths: 1, dueDay: 5, askingRent: 16000,
      depositRefundable: true,
    },
    amenities: ["wifi", "washing machine", "power backup", "cupboard"],
    rules: { gateClosing: "11:30pm", guests: "Not in rooms", cooking: "No", smoking: "No" },
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
        "bathroom-smell": { checked: true, note: "" },
        "night-noise": { checked: false, note: "Metro audible until midnight" },
      },
    },
    notes: "Negotiated down from ₹16,000. Owner wants a 3-month lock-in. "
      + "Food is decent — ate dinner there during the visit. Roommates are both working, quiet.",
    tags: ["broker-rahul", "visited-sunday"],
    lastVerifiedAt: "2026-11-12",
  },
  {
    name: "Royal Stay — single room",
    kind: "pg",
    status: "visited",
    lat: 19.1176,
    lng: 72.906,
    area: "Powai",
    landmark: "Behind Hiranandani market",
    contact: { person: "Mrs. Nair (owner)", phone: "9123456780", source: "owner" },
    room: { sharing: 1, gender: "any", furnished: "semi-furnished", floor: "4th", attachedBath: true, ac: true, balcony: true, lift: true },
    food: { included: false, kitchenAccess: true },
    costs: {
      rent: 26000, deposit: 52000, brokerage: 0, utilities: 3000,
      commuteMonthly: 2640, setupCost: 6000, advanceMonths: 1,
      lockInMonths: 6, noticeMonths: 1, dueDay: 1, depositRefundable: true,
    },
    amenities: ["wifi", "fridge", "lift", "parking", "geyser", "cctv"],
    rules: { gateClosing: "None", guests: "Allowed in common area", cooking: "Yes" },
    ratings: { safety: 5, cleanliness: 5, water: 5, landlord: 4, signal: 4 },
    commute: { minutesToWork: 40, nearestStation: "Kanjurmarg", stationWalkMin: 20 },
    notes: "Lovely room, own kitchen, no brokerage because it's direct with the owner. "
      + "But ₹84,000 on day one and a 6-month lock-in — leaving in month 3 would cost about ₹1,04,000. "
      + "Also the only option where food is fully on me.",
    tags: ["direct-owner", "stretch"],
    lastVerifiedAt: "2026-11-10",
  },
  {
    name: "Shree PG",
    kind: "pg",
    status: "toVisit",
    lat: 19.2952,
    lng: 72.8544,
    area: "Mira Road",
    landmark: "10 min walk east of the station",
    contact: { person: "Imran (broker)", phone: "9988776655", source: "broker" },
    room: { sharing: 2, gender: "male", furnished: "fully furnished" },
    food: { included: true, meals: "All three", vegOnly: false },
    costs: {
      rent: 9500, deposit: 19000, brokerage: 9500, utilities: 1000,
      commuteMonthly: 3400, setupCost: 3500, advanceMonths: 1, dueDay: 7,
    },
    amenities: ["wifi", "washing machine"],
    commute: { minutesToWork: 75, nearestStation: "Mira Road", stationWalkMin: 10 },
    notes: "Cheapest on paper by a wide margin. 75 minutes each way is the catch — "
      + "set the commute-time value in Money settings to see what that's really worth.",
    tags: ["broker-imran", "cheapest"],
    lastVerifiedAt: "2026-11-13",
  },
  {
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
      + "with 'conditions' on the refund that the manager wouldn't put in writing. "
      + "Day-one cash was ₹66,000 for the worst room I saw.",
    notes: "Kept as a record — the deposit terms are the reason to ask every other place "
      + "to state refund conditions in writing.",
    tags: ["deposit-trap"],
    lastVerifiedAt: "2026-10-28",
  },
  {
    name: "Work — BKC",
    kind: "office",
    status: "current",
    lat: 19.0662,
    lng: 72.8691,
    area: "Bandra Kurla Complex",
    notes: "Set as the work pin in Money settings, which is what drives the "
      + "distance-from-work column and the commute-time lens.",
    tags: ["work"],
  },
];
