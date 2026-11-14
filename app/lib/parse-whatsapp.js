/**
 * Pull the facts out of a broker's message.
 *
 * This is where the "capture an option in under 60 seconds" requirement is
 * actually won (ADR-0006): at 11pm with five options in a WhatsApp thread, the
 * difference between a used app and an abandoned one is whether the user has to
 * retype everything.
 *
 * Output is always *proposed* values for the user to confirm or reject —
 * nothing here is saved silently. Being wrong is therefore cheap; being silent
 * would not be.
 */

/** Mumbai localities, for guessing the area from free text. */
const LOCALITIES = [
  "Andheri East", "Andheri West", "Bandra East", "Bandra West", "Borivali", "Chembur",
  "Churchgate", "Colaba", "Dadar", "Ghatkopar", "Goregaon East", "Goregaon West",
  "Jogeshwari", "Juhu", "Kandivali", "Kanjurmarg", "Khar", "Kurla", "Lower Parel",
  "Malad East", "Malad West", "Marine Lines", "Matunga", "Mira Road", "Mulund",
  "Nahur", "Nerul", "Parel", "Powai", "Prabhadevi", "Santacruz East", "Santacruz West",
  "Sion", "Thane", "Vashi", "Versova", "Vikhroli", "Vile Parle East", "Vile Parle West",
  "Wadala", "Worli", "Bhandup", "Byculla", "Chakala", "Marol", "Saki Naka", "BKC",
  "Bandra Kurla Complex", "Seawoods", "Airoli", "Ghansoli", "Dombivli", "Kalyan",
];

/**
 * "15,000" · "15k" · "₹15000" · "1.5L" → a number.
 * `k`/`l` suffixes are the common shorthand in listings and must not be dropped.
 */
export function parseAmount(raw) {
  if (!raw) return null;
  const text = String(raw).toLowerCase().replace(/[₹,\s]/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k|l|lakh|lac)?/);
  if (!match) return null;

  let value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  const suffix = match[2];
  if (suffix === "k") value *= 1000;
  else if (suffix) value *= 100000;

  // A bare "15" next to the word rent means 15 thousand, not fifteen rupees.
  if (!suffix && value > 0 && value < 200) value *= 1000;
  return Math.round(value);
}

const SHARING_WORDS = {
  single: 1, "1": 1, double: 2, two: 2, twin: 2, "2": 2,
  triple: 3, three: 3, "3": 3, four: 4, quad: 4, "4": 4,
};

const near = (source, keywords, window = 24) => {
  const text = source.toLowerCase();
  for (const keyword of keywords) {
    const index = text.indexOf(keyword);
    if (index === -1) continue;
    const slice = text.slice(index, index + keyword.length + window);
    const amount = slice.match(/(?:₹|rs\.?|inr)?\s*(\d[\d,.]*\s*(?:k|l|lakh|lac)?)/i);
    if (amount) return parseAmount(amount[1]);
  }
  return null;
};

/**
 * Deposits and brokerage are usually quoted in months, not rupees — "brokerage
 * 1 month", "2 months deposit". Reading that as ₹1 would be worse than reading
 * nothing, so it is handled explicitly in both word orders.
 */
function monthsFor(text, word) {
  // The alternation must be grouped — `deposit|security[…]` would match the
  // bare word "deposit" with no captured number and yield NaN.
  const after = text.match(new RegExp(`(?:${word})[^\\n.]{0,20}?(\\d+)\\s*month`, "i"));
  const before = text.match(new RegExp(`(\\d+)\\s*months?[^\\n.]{0,20}?(?:${word})`, "i"));
  const match = after || before;
  const months = match ? Number(match[1]) : NaN;
  return Number.isFinite(months) ? months : null;
}

/**
 * Returns proposed field values, each with the evidence that produced it so the
 * user can judge it at a glance rather than trusting a black box.
 */
export function parseListingText(input) {
  const text = String(input || "");
  if (!text.trim()) return { fields: [], name: "", unmatched: text };

  const lower = text.toLowerCase();
  const fields = [];
  const propose = (path, label, value, display, evidence) => {
    if (value === null || value === undefined || value === "") return;
    fields.push({ path, label, value, display: display ?? String(value), evidence });
  };

  /* --- rent ------------------------------------------------------------- */
  let rent = near(text, ["rent", "rent:", "monthly", "per month", "pm "]);
  if (rent === null) {
    // No keyword: take the largest "k"-style figure, which in a listing is
    // nearly always the rent rather than a floor number or a phone fragment.
    const candidates = [...text.matchAll(/(?:₹|rs\.?)\s*(\d[\d,]*(?:\.\d+)?\s*k?)/gi)]
      .map((match) => parseAmount(match[1]))
      .filter((value) => value !== null && value >= 2000 && value <= 200000);
    if (candidates.length) rent = Math.min(...candidates);
  }
  propose("costs.rent", "Rent", rent, rent ? `₹${rent.toLocaleString("en-IN")}` : null, "rent");

  /* --- deposit ---------------------------------------------------------- */
  const depositMonths = monthsFor(text, "deposit|security");
  if (depositMonths !== null && rent !== null) {
    const deposit = depositMonths * rent;
    propose("costs.deposit", "Deposit", deposit,
      `₹${deposit.toLocaleString("en-IN")} — ${depositMonths} month${depositMonths === 1 ? "" : "s"}' rent`,
      `${depositMonths} months deposit`);
  } else {
    const deposit = near(text, ["deposit", "security", "dep ", "dep:", "refundable"]);
    propose("costs.deposit", "Deposit", deposit, deposit ? `₹${deposit.toLocaleString("en-IN")}` : null, "deposit");
  }

  /* --- brokerage -------------------------------------------------------- */
  if (/brokerage\s*free|no\s*brokerage|without\s*brokerage|direct\s*owner|owner\s*direct|no\s*broker/i.test(text)) {
    propose("costs.brokerage", "Brokerage", 0, "₹0 — brokerage free", "brokerage free");
  } else {
    const brokerageMonths = monthsFor(text, "brokerage|commission");
    if (brokerageMonths !== null && rent !== null) {
      const brokerage = brokerageMonths * rent;
      propose("costs.brokerage", "Brokerage", brokerage,
        `₹${brokerage.toLocaleString("en-IN")} — ${brokerageMonths} month${brokerageMonths === 1 ? "" : "s"}' rent`,
        `${brokerageMonths} month brokerage`);
    } else {
      const brokerage = near(text, ["brokerage", "broker charge", "commission"]);
      propose("costs.brokerage", "Brokerage", brokerage,
        brokerage ? `₹${brokerage.toLocaleString("en-IN")}` : null, "brokerage");
    }
  }

  /* --- sharing ---------------------------------------------------------- */
  const sharingMatch = lower.match(
    /(single|double|twin|triple|two|three|four|quad|\d)\s*(?:-|\s)?\s*(?:sharing|share|seater|seats?|bed)/,
  );
  if (sharingMatch) {
    const value = SHARING_WORDS[sharingMatch[1]];
    propose("room.sharing", "Sharing", value, value === 1 ? "single room" : `${value}-sharing`, sharingMatch[0]);
  } else if (/\bsingle\s*(?:room|occupancy)\b/.test(lower)) {
    propose("room.sharing", "Sharing", 1, "single room", "single room");
  }

  /* --- food ------------------------------------------------------------- */
  if (/with\s*food|food\s*included|including\s*food|meals?\s*included/i.test(text)
    || /\b(mess|tiffin)\s*(?:included|available|facility)/i.test(text)) {
    propose("food.included", "Food", true, "included", "with food");
  } else if (/without\s*food|no\s*food|food\s*(?:is\s*)?(?:extra|separate|not included)/i.test(text)) {
    propose("food.included", "Food", false, "not included", "without food");
  }

  /* --- phone ------------------------------------------------------------ */
  const phone = text.match(/(?:\+?91[\s-]?)?\b([6-9]\d{9})\b/);
  if (phone) propose("contact.phone", "Phone", phone[1], phone[1], phone[0].trim());

  /* --- gender ----------------------------------------------------------- */
  if (/\b(girls?|ladies|female|women)\b/i.test(text)) {
    propose("room.gender", "For", "female", "female", "girls");
  } else if (/\b(boys?|gents?|male|men)\b/i.test(text)) {
    propose("room.gender", "For", "male", "male", "boys");
  }

  /* --- locality --------------------------------------------------------- */
  const locality = LOCALITIES
    .filter((name) => lower.includes(name.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0]; // prefer "Andheri East" over "Andheri"
  if (locality) propose("area", "Area", locality, locality, locality);

  /* --- amenities -------------------------------------------------------- */
  const amenities = [
    ["wifi", /\bwi-?fi\b|internet/i],
    ["washing machine", /washing\s*machine|laundry/i],
    ["fridge", /fridge|refrigerator/i],
    ["power backup", /power\s*backup|inverter|generator/i],
    ["lift", /\blift\b|elevator/i],
    ["ac", /\bac\b|air\s*condition/i],
    ["parking", /parking/i],
    ["cctv", /cctv|camera/i],
    ["attached bathroom", /attached\s*(?:bath|washroom|toilet)/i],
  ].filter(([, pattern]) => pattern.test(text)).map(([label]) => label);

  if (amenities.length) {
    propose("amenities", "Amenities", amenities, amenities.join(", "), "keywords");
  }

  /* --- lock-in / notice ------------------------------------------------- */
  const lockIn = lower.match(/(\d+)\s*month[s]?\s*(?:lock[\s-]?in|lockin|minimum)/);
  if (lockIn) propose("costs.lockInMonths", "Lock-in", Number(lockIn[1]), `${lockIn[1]} months`, lockIn[0]);

  const notice = lower.match(/(\d+)\s*month[s]?\s*notice/);
  if (notice) propose("costs.noticeMonths", "Notice", Number(notice[1]), `${notice[1]} months`, notice[0]);

  /* --- a usable name ---------------------------------------------------- */
  const nameLine = text.split(/[\n•|]/)
    .map((line) => line.trim())
    .find((line) => /\b(pg|hostel|stay|nivas|krupa|residency|house|lodge|accommodation)\b/i.test(line)
      && line.length < 60);

  const name = nameLine
    ? nameLine.replace(/^[^a-zA-Z0-9₹]+/, "").replace(/[-–:,]\s*$/, "").slice(0, 60)
    : "";

  return { fields, name, raw: text };
}
