/**
 * The schema, as data.
 *
 * Forms, the detail drawer, the compare table and CSV export are all generated
 * from FIELD_GROUPS below, so adding a field is one line in one file and it
 * appears everywhere correctly labelled. See decisions/ADR-0006.
 *
 * Rule that governs everything here: the pin is the only required input.
 * Every other field may be empty forever, and empty means *unknown*, never zero.
 */

import { uid, nowISO, todayISO, getPath, num } from "./lib/util.js";

/* ------------------------------------------------------------ taxonomies -- */

export const KINDS = [
  { value: "pg", label: "PG / room", icon: "🛏️" },
  { value: "food", label: "Food / mess", icon: "🍽️" },
  { value: "landmark", label: "Landmark / park", icon: "🌳" },
  { value: "office", label: "Office / college", icon: "💼" },
  { value: "transit", label: "Station / transit", icon: "🚉" },
  { value: "other", label: "Other", icon: "📍" },
];

/** Status drives pin colour and is the most-used field in the app (ADR-0004). */
export const STATUSES = [
  { value: "lead", label: "Lead", color: "#94a3b8", hint: "Heard about it, nothing verified" },
  { value: "toVisit", label: "To visit", color: "#3b82f6", hint: "Worth a trip" },
  { value: "visited", label: "Visited", color: "#f59e0b", hint: "Seen it in person" },
  { value: "shortlist", label: "Shortlisted", color: "#22c55e", hint: "Serious contender" },
  { value: "rejected", label: "Rejected", color: "#ef4444", hint: "Ruled out — kept for the reason why" },
  { value: "current", label: "Current home", color: "#a855f7", hint: "Where I live now" },
];

export const SOURCES = ["owner", "broker", "friend", "listing site", "walk-in", "other"];
export const GENDERS = ["any", "male", "female", "couple"];
export const FURNISHED = ["unfurnished", "semi-furnished", "fully furnished"];

/** Media asks for specific shots by name — the forgotten ones decide it (ADR-0007). */
export const MEDIA_SLOTS = [
  { value: "room", label: "Room" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "entrance", label: "Entrance / building" },
  { value: "street-night", label: "Street at night" },
  { value: "walk-to-station", label: "Walk to station" },
  { value: "voice", label: "Voice note" },
  { value: "other", label: "Other" },
];

/** Ten ticks, no typing. Highest value per unit of effort in the whole app. */
export const CHECKLIST = [
  { slug: "water-pressure", label: "Water pressure in the bathroom" },
  { slug: "signal", label: "Mobile signal inside the room" },
  { slug: "window", label: "Window opens to outside (not a shaft)" },
  { slug: "plugs", label: "Plug points near the bed" },
  { slug: "bathroom-smell", label: "Bathroom doesn't smell" },
  { slug: "night-noise", label: "Quiet at night" },
  { slug: "door-lock", label: "Lock on the room door" },
  { slug: "kitchen-access", label: "Kitchen / fridge access" },
  { slug: "floor-lift", label: "Floor is reachable (lift, or low enough)" },
  { slug: "station-walk", label: "Walk to station is tolerable" },
];

export const AMENITIES = [
  "wifi", "washing machine", "fridge", "power backup", "lift", "parking",
  "water purifier", "housekeeping", "cupboard", "study table", "geyser", "cctv",
];

export const LEDGER_CATEGORIES = [
  "rent", "deposit", "brokerage", "electricity", "water", "wifi", "food", "setup", "other",
];

export const LEDGER_STATUSES = [
  { value: "due", label: "Due", color: "#f59e0b" },
  { value: "paid", label: "Paid", color: "#22c55e" },
  { value: "owedToMe", label: "Owed to me", color: "#3b82f6" },
  { value: "refundPending", label: "Refund pending", color: "#a855f7" },
  { value: "refunded", label: "Refunded", color: "#64748b" },
];

export const RATING_FIELDS = [
  { path: "ratings.safety", label: "Safety" },
  { path: "ratings.cleanliness", label: "Cleanliness" },
  { path: "ratings.foodQuality", label: "Food" },
  { path: "ratings.water", label: "Water" },
  { path: "ratings.landlord", label: "Landlord" },
  { path: "ratings.signal", label: "Mobile signal" },
];

export const statusMeta = (value) =>
  STATUSES.find((s) => s.value === value) || STATUSES[0];
export const kindMeta = (value) =>
  KINDS.find((k) => k.value === value) || KINDS[KINDS.length - 1];
export const ledgerStatusMeta = (value) =>
  LEDGER_STATUSES.find((s) => s.value === value) || LEDGER_STATUSES[0];

/* --------------------------------------------------------------- settings -- */

export const DEFAULT_SETTINGS = {
  budgetMonthly: 20000,
  stayMonths: 12,
  foodEstimate: 6000,
  utilitiesAssumed: 1200,
  commuteDays: 22,
  timeValuePerHour: 0,
  privacyPremium: 0,
  depositHaircutPercent: 0,
  depositRate: 7,
  showDepositOpportunity: false,
  pillCap: 25,
  showRejected: false,
  showStations: true,
  searchArea: null,      // {label, lat, lng} — the area you are hunting in
  searchRadiusKm: 5,
  lastView: null,        // {lat, lng, zoom} — so the map reopens where you left it
  staleAfterDays: 21,
  workPin: null,
  mapProvider: null,
  lastBackupAt: null,
  writesSinceBackup: 0,
  promptedTimeValue: false,
};

/* ----------------------------------------------------- the seven inputs --- */

/**
 * The seven fields that carry both headline numbers (ADR-0005). `assume` names
 * the setting used as a stand-in when the field is blank, which is what lets
 * TMC render as a range instead of a falsely precise total. Rent has no
 * stand-in: without it there is no number worth showing.
 */
export const MONEY_INPUTS = [
  { key: "rent", path: "costs.rent", label: "Rent", assume: null },
  { key: "deposit", path: "costs.deposit", label: "Deposit", assume: null },
  { key: "brokerage", path: "costs.brokerage", label: "Brokerage", assume: null },
  { key: "food", path: "food.included", label: "Food included?", assume: "foodEstimate" },
  { key: "utilities", path: "costs.utilities", label: "Utilities", assume: "utilitiesAssumed" },
  { key: "commute", path: "costs.commuteMonthly", label: "Commute", assume: null },
  { key: "stay", path: "costs.stayMonthsOverride", label: "Expected stay", assume: "stayMonths" },
];

/* ----------------------------------------------------------- field groups -- */

/**
 * Groups render in order. `collapsed: true` means progressive disclosure —
 * the user opens what they actually know. `width` is a grid hint: "half" by
 * default, "full" for anything that needs the row.
 */
export const FIELD_GROUPS = [
  {
    id: "essentials",
    label: "Essentials",
    collapsed: false,
    fields: [
      { path: "name", label: "Name", type: "text", width: "full", placeholder: "Sai Krupa PG" },
      { path: "kind", label: "Type of place", type: "select", options: KINDS },
      { path: "status", label: "Status", type: "select", options: STATUSES },
      { path: "area", label: "Area / locality", type: "text", placeholder: "Andheri East" },
      { path: "landmark", label: "Landmark", type: "text", placeholder: "Near Chakala Metro" },
      { path: "address", label: "Address", type: "textarea", width: "full" },
      { path: "contact.person", label: "Contact name", type: "text" },
      { path: "contact.phone", label: "Phone", type: "tel", placeholder: "98XXXXXXXX" },
      { path: "contact.altPhone", label: "Alternate phone", type: "tel" },
      { path: "contact.source", label: "Heard from", type: "select", options: SOURCES },
    ],
  },
  {
    id: "money",
    label: "Money",
    collapsed: false,
    hint: "These seven fields produce both headline numbers. Leave anything you don't know blank.",
    fields: [
      { path: "costs.rent", label: "Rent / month", type: "money", hint: "What you pay, after negotiation" },
      { path: "costs.deposit", label: "Security deposit", type: "money" },
      { path: "costs.brokerage", label: "Brokerage", type: "money", hint: "0 if direct owner" },
      { path: "food.included", label: "Food included", type: "tristate" },
      {
        path: "costs.utilities", label: "Utilities / month", type: "money",
        hint: "Electricity + water + wifi + laundry + maintenance, as one estimate",
      },
      { path: "costs.commuteMonthly", label: "Commute / month", type: "money", hint: "Round-trip fare × travel days" },
    ],
  },
  {
    id: "money-detail",
    label: "Money — detail",
    collapsed: true,
    hint: "Only worth filling in for the one or two finalists.",
    fields: [
      { path: "costs.advanceMonths", label: "Advance months", type: "number", min: 0, max: 6, hint: "Rent payable upfront" },
      { path: "costs.setupCost", label: "One-time setup", type: "money", hint: "Mattress, bucket, lock, hangers" },
      { path: "costs.foodCostOverride", label: "Actual food cost", type: "money", hint: "Overrides the global estimate" },
      { path: "costs.askingRent", label: "Rent first quoted", type: "money", hint: "Keeps your negotiation visible" },
      { path: "costs.stayMonthsOverride", label: "Expected stay (months)", type: "number", min: 1, max: 60 },
      { path: "costs.lockInMonths", label: "Lock-in (months)", type: "number", min: 0, max: 24 },
      { path: "costs.noticeMonths", label: "Notice period (months)", type: "number", min: 0, max: 6 },
      { path: "costs.dueDay", label: "Rent due on day", type: "number", min: 1, max: 31 },
      { path: "costs.depositRefundable", label: "Deposit is refundable", type: "bool", default: true },
      { path: "costs.utilitiesBreakdown.electricity", label: "— Electricity", type: "money" },
      { path: "costs.utilitiesBreakdown.water", label: "— Water", type: "money" },
      { path: "costs.utilitiesBreakdown.wifi", label: "— Wifi", type: "money" },
      { path: "costs.utilitiesBreakdown.laundry", label: "— Laundry", type: "money" },
      { path: "costs.utilitiesBreakdown.maintenance", label: "— Maintenance", type: "money" },
    ],
  },
  {
    id: "room",
    label: "Room",
    collapsed: true,
    fields: [
      { path: "room.sharing", label: "Sharing", type: "number", min: 1, max: 6, hint: "1 = single room" },
      { path: "room.gender", label: "For", type: "select", options: GENDERS },
      { path: "room.furnished", label: "Furnishing", type: "select", options: FURNISHED },
      { path: "room.floor", label: "Floor", type: "text" },
      { path: "room.attachedBath", label: "Attached bathroom", type: "bool" },
      { path: "room.ac", label: "AC", type: "bool" },
      { path: "room.balcony", label: "Balcony", type: "bool" },
      { path: "room.lift", label: "Lift in building", type: "bool" },
      { path: "amenities", label: "Amenities", type: "tags", width: "full", suggestions: AMENITIES },
    ],
  },
  {
    id: "food",
    label: "Food",
    collapsed: true,
    fields: [
      { path: "food.meals", label: "Meals provided", type: "text", placeholder: "Breakfast + dinner" },
      { path: "food.vegOnly", label: "Pure veg only", type: "bool" },
      { path: "food.kitchenAccess", label: "Can use the kitchen", type: "bool" },
      { path: "food.notes", label: "Food notes", type: "textarea", width: "full" },
    ],
  },
  {
    id: "rules",
    label: "House rules",
    collapsed: true,
    fields: [
      { path: "rules.gateClosing", label: "Gate closes at", type: "text", placeholder: "11pm" },
      { path: "rules.guests", label: "Guests allowed", type: "text" },
      { path: "rules.cooking", label: "Cooking allowed", type: "text" },
      { path: "rules.smoking", label: "Smoking / drinking", type: "text" },
      { path: "rules.notes", label: "Other rules", type: "textarea", width: "full" },
    ],
  },
  {
    id: "ratings",
    label: "Your ratings",
    collapsed: true,
    hint: "Fill these in right after a visit, while it is still fresh.",
    fields: RATING_FIELDS.map((f) => ({ ...f, type: "rating", width: "full" })),
  },
  {
    id: "commute",
    label: "Commute",
    collapsed: true,
    fields: [
      { path: "commute.minutesToWork", label: "Minutes to work (one way)", type: "number", min: 0, max: 240 },
      { path: "commute.nearestStation", label: "Nearest station", type: "text" },
      { path: "commute.stationWalkMin", label: "Walk to station (min)", type: "number", min: 0, max: 60 },
    ],
  },
  {
    id: "research",
    label: "Notes & research",
    collapsed: true,
    fields: [
      { path: "notes", label: "Notes", type: "textarea", width: "full", rows: 5 },
      { path: "rejectedReason", label: "Why rejected", type: "textarea", width: "full", hint: "The most useful note you will write. Rejected places are hidden, never deleted." },
      { path: "tags", label: "Tags", type: "tags", width: "full" },
      { path: "links", label: "Listing links", type: "lines", width: "full", hint: "One URL per line" },
      { path: "visit.date", label: "Visit date", type: "date" },
      { path: "lastVerifiedAt", label: "Last verified", type: "date" },
    ],
  },
];

/** Flat list of every declared field, for CSV export and search. */
export const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

export const findField = (path) => ALL_FIELDS.find((f) => f.path === path);

/* --------------------------------------------------------------- factories -- */

export function newPoint(partial = {}) {
  return {
    id: uid("pt"),
    name: "",
    kind: "pg",
    status: "lead",
    lat: null,
    lng: null,
    address: "",
    area: "",
    landmark: "",
    rejectedReason: "",
    contact: { person: "", phone: "", altPhone: "", source: "" },
    room: {
      sharing: null, gender: "", furnished: "", floor: "",
      attachedBath: false, ac: false, balcony: false, lift: false,
    },
    food: { included: null, meals: "", vegOnly: false, kitchenAccess: false, notes: "" },
    costs: {
      rent: null, deposit: null, brokerage: null, utilities: null, commuteMonthly: null,
      advanceMonths: null, setupCost: null, foodCostOverride: null, askingRent: null,
      stayMonthsOverride: null, lockInMonths: null, noticeMonths: null, dueDay: null,
      depositRefundable: true,
      utilitiesBreakdown: { electricity: null, water: null, wifi: null, laundry: null, maintenance: null },
    },
    amenities: [],
    rules: { gateClosing: "", guests: "", cooking: "", smoking: "", notes: "" },
    ratings: { safety: null, cleanliness: null, foodQuality: null, water: null, landlord: null, signal: null },
    commute: { minutesToWork: null, nearestStation: "", stationWalkMin: null },
    media: [],
    visit: { date: "", done: false, checklist: {} },
    ledger: [],
    tags: [],
    links: [],
    notes: "",
    lastVerifiedAt: todayISO(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...partial,
  };
}

export const newLedgerEntry = (partial = {}) => ({
  id: uid("lg"),
  date: todayISO(),
  category: "rent",
  amount: null,
  status: "due",
  splitN: 1,
  proof: null,
  note: "",
  ...partial,
});

export const newMediaItem = (partial = {}) => ({
  id: uid("md"),
  slot: "other",
  type: "image",
  src: "",
  caption: "",
  addedAt: nowISO(),
  ...partial,
});

/* ---------------------------------------------------------------- derived -- */

/** A display name even for a point the user never named. */
export function pointTitle(point) {
  if (point?.name?.trim()) return point.name.trim();
  if (point?.area?.trim()) return `Pin near ${point.area.trim()}`;
  return "Unnamed pin";
}

/**
 * How filled-in a record is, as a 0–1 fraction over fields that are worth
 * having. Rendered as a quiet ring, never as a validation error (ADR-0006).
 */
export function completeness(point) {
  const paths = [
    "name", "area", "contact.phone", "costs.rent", "costs.deposit",
    "costs.brokerage", "food.included", "costs.utilities", "costs.commuteMonthly",
    "room.sharing", "commute.minutesToWork", "notes",
  ];
  const filled = paths.filter((path) => {
    const value = getPath(point, path);
    if (value === null || value === undefined || value === "") return false;
    if (typeof value === "number") return Number.isFinite(value);
    return true;
  }).length;
  const mediaBonus = point?.media?.length ? 1 : 0;
  const visitBonus = Object.keys(point?.visit?.checklist || {}).length ? 1 : 0;
  return (filled + mediaBonus + visitBonus) / (paths.length + 2);
}

/** Everything searchable about a point, lowercased, in one string. */
export function pointSearchText(point) {
  return [
    point.name, point.area, point.address, point.landmark, point.notes,
    point.rejectedReason, point.contact?.person, point.contact?.phone,
    point.contact?.altPhone, point.commute?.nearestStation,
    ...(point.tags || []), ...(point.amenities || []),
    ...(point.media || []).map((m) => m.caption),
  ].filter(Boolean).join(" ").toLowerCase();
}

export const isStale = (point, settings) => {
  if (point.status === "rejected" || point.status === "current") return false;
  const days = point.lastVerifiedAt
    ? Math.floor((Date.now() - new Date(point.lastVerifiedAt).getTime()) / 86_400_000)
    : null;
  return days !== null && days > (settings?.staleAfterDays ?? 21);
};

export const hasLocation = (point) => num(point?.lat) !== null && num(point?.lng) !== null;
