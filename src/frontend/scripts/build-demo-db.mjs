/**
 * Build a slim, browser-ready SQLite database for the S-Pankki demo.
 *
 * Reads the full challenge CSVs from data/raw/ (gitignored) and writes a small
 * database containing only the demo customers, their transactions and their
 * mortgage application. The result is shipped as a static asset and queried in
 * the browser with sql.js.
 *
 * Usage:
 *   npm run build:data                       # default demo customers
 *   node scripts/build-demo-db.mjs --customers CUST04457,CUST04415 --out ../public/data/x.db
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { assignMerchantNames } from "./merchant-names.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const RAW = path.join(ROOT, "data/raw");
const DEFAULT_OUT = path.join(ROOT, "src/frontend/public/data/s_pankki-demo.db");

// Michal's four mortgage applicants (CUST00382 and CUST04415 sweep their salary to another account),
// plus four T-010 dashboard profiles: young adult, high earner, often negative, heavy restaurant spender.
const DEFAULT_CUSTOMERS = [
  "CUST04457", "CUST04415", "CUST00382", "CUST00296",
  "CUST03953", "CUST00614", "CUST00367", "CUST04506",
  // T-016: a customer whose OWN purchase history shows a late-evening big-spending habit (found by a one-off check).
  "CUST03172",
];

// Demo tweak: the default persona starts with less in the account, so the Time machine saving is a larger share of
// what they have. Only the running balance is scaled; transaction amounts and the monthly surplus stay untouched.
const BALANCE_SCALE = { CUST04457: 0.1 };

const SCHEMA = `
CREATE TABLE customers (
  customer_id          TEXT PRIMARY KEY,
  customer_postal_code TEXT,
  customer_age         INTEGER
);
CREATE TABLE merchants (
  merchant_id TEXT NOT NULL,
  mcc_code    TEXT NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT,
  PRIMARY KEY (merchant_id, mcc_code)
);
CREATE TABLE transactions (
  id                INTEGER PRIMARY KEY,
  customer_id       TEXT NOT NULL,
  bank_account_id   TEXT,
  tx_date           TEXT NOT NULL,
  tx_timestamp      TEXT,
  tx_ts_iso         TEXT,
  category          TEXT,
  tx_amount_eur     REAL,
  balance_after_eur REAL,
  transaction_type  TEXT,
  merchant_id       TEXT,
  mcc_code          TEXT
);
CREATE TABLE mortgage_links (
  mortgage_customer_id        TEXT PRIMARY KEY,
  customer_id                 TEXT NOT NULL,
  final_decision              TEXT,
  rejection_reason            TEXT,
  final_property_price_eur    REAL,
  final_requested_loan_eur    REAL,
  final_equity_amount_eur     REAL,
  final_collateral_value_eur  REAL,
  required_monthly_income_eur REAL,
  final_loan_to_value         REAL
);
CREATE TABLE mortgage_events (
  id                      INTEGER PRIMARY KEY,
  mortgage_customer_id    TEXT NOT NULL,
  timestamp               TEXT,
  event_type              TEXT,
  property_id             TEXT,
  property_type           TEXT,
  property_price_estimate REAL,
  loan_amount             REAL,
  equity_amount           REAL,
  collateral_type         TEXT,
  collateral_value        REAL,
  collateral_status       TEXT,
  decision                TEXT,
  rejection_reason        TEXT,
  expense_type            TEXT,
  expense_amount          REAL,
  note                    TEXT
);
`;

/** Minimal CSV line parser (quotes, escaped quotes). */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const num = (v) => {
  const t = (v ?? "").trim();
  return t === "" ? null : Number(t);
};

function readCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

async function streamTransactions(file, wanted) {
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });
  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    if (!line) continue;
    const comma = line.indexOf(",");
    const customerId = line.slice(0, comma);
    if (!wanted.has(customerId)) continue;
    const c = line.split(",");
    const [, hh = "00", mm = "00", ss = "00"] = (c[3] || "").split(":");
    rows.push([
      c[0], c[1], c[2], c[3], `${c[2]}T${hh}:${mm}:${ss}`,
      c[4], num(c[5]), num(c[6]), c[7], c[8], c[9],
    ]);
  }
  return rows;
}

/**
 * Merchant directory from the final rows (generated ones included). Keyed on (merchant, MCC):
 * a few merchant ids appear with more than one MCC, and a fuel payment must not share a name
 * with a taxi ride.
 */
function collectMerchants(rows) {
  const merchants = new Map();
  for (const row of rows) {
    const merchantId = row[9];
    if (!merchantId) continue;
    const mccCode = row[10] || "";
    const key = `${merchantId}|${mccCode}`;
    if (!merchants.has(key)) merchants.set(key, { merchantId, mccCode, category: row[5] });
  }
  return merchants;
}

/* ------------------------------------------------------- demo habits */

/**
 * Hand-written habit for the demo customer. The dataset's merchant ids carry no names and its
 * purchases are scattered over many places, so the AI overview has nothing recognisable to call a
 * habit. This rule makes CUST04457 (the default demo customer) a regular at one restaurant in the
 * month the app opens on:
 *
 *  - their existing weekday restaurant purchases in that month move to the habit merchant, at lunch;
 *  - one Thursday lunch is added for every week without such a purchase.
 *
 * It is limited to the latest month on purpose: when it covered two years, every month's advice was
 * the same. Earlier months get their own story from `DEMO_MONTH_THEMES` below.
 */
const DEMO_HABITS = [
  {
    customerId: "CUST04457",
    merchantId: "MRC-RES-0022",
    category: "Restaurants",
    mccCode: "5812",
    weekdays: [1, 2, 3, 4, 5],
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    weeklyWeekday: 4,
    lunchHour: 12,
    amountEur: [13.9, 19.9],
  },
];

const pad2 = (n) => String(n).padStart(2, "0");
const MONTH_CODES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const round2 = (value) => Math.round(value * 100) / 100;

/* ------------------------------------------------- monthly variety */

/**
 * Sparse months in the source data have as little as 140 € of purchases, so every overview was driven
 * by the same injected habit. `DEMO_MONTH_THEMES` gives each month its own story, and months below
 * `BASELINE_EUR` also get an ordinary everyday basket so the screen never looks empty.
 *
 * All of it is deterministic (same build, same rows) and only for the demo customer's own statement.
 */
const BASELINE_EUR = 480;
const DEMO_MONTH_THEMES = {
  "2024-10": "calm",
  "2025-01": "taxi",
  "2025-02": "health",
  "2025-03": "travel",
  "2025-04": "calm",
  "2025-06": "spree",
  "2025-07": "travel",
  "2025-10": "lifestyle",
  "2025-11": "taxi",
  "2025-12": "spree",
  "2026-01": "health",
  "2026-02": "travel",
  "2026-03": "dining",
  "2026-04": "calm",
  "2026-05": "spree",
  "2026-06": "travel",
  "2026-07": "dining",
  "2026-08": "taxi",
  "2026-09": "habit",
};

/** An ordinary month: merchant ids the demo customer already uses in the raw data. */
const BASELINE_TEMPLATES = [
  { category: "Groceries", merchantId: "MRC-GRO-0029", mccCode: "5411", minEur: 45, maxEur: 90, hour: 9 },
  { category: "Groceries", merchantId: "MRC-GRO-0032", mccCode: "5411", minEur: 40, maxEur: 80, hour: 17 },
  { category: "Groceries", merchantId: "MRC-GRO-0049", mccCode: "5411", minEur: 30, maxEur: 65, hour: 11 },
  { category: "Restaurants", merchantId: "MRC-RES-0010", mccCode: "5812", minEur: 30, maxEur: 65, hour: 19 },
  { category: "Restaurants", merchantId: "MRC-RES-0085", mccCode: "5814", minEur: 12, maxEur: 22, hour: 12 },
  { category: "Transportation", merchantId: "MRC-TRN-0005", mccCode: "4111", minEur: 3.5, maxEur: 6.5, hour: 8 },
  { category: "Transportation", merchantId: "MRC-TRN-0027", mccCode: "5541", minEur: 40, maxEur: 70, hour: 17 },
  { category: "Entertainment", merchantId: "MRC-ENT-0006", mccCode: "7832", minEur: 18, maxEur: 40, hour: 18 },
  { category: "Lifestyle", merchantId: "MRC-LIF-0042", mccCode: "5651", minEur: 25, maxEur: 70, hour: 15 },
  { category: "Health", merchantId: "MRC-HEA-0052", mccCode: "5912", minEur: 14, maxEur: 45, hour: 10 },
  { category: "Entertainment", merchantId: "MRC-ENT-0022", mccCode: "7999", minEur: 20, maxEur: 45, hour: 19 },
  { category: "Lifestyle", merchantId: "MRC-LIF-0021", mccCode: "5941", minEur: 20, maxEur: 50, hour: 14 },
];

/** Deterministic "random" amount, so rebuilding gives the same database. */
function seededAmount(seed, minEur, maxEur) {
  const unit = ((seed * 37) % 997) / 997;
  return round2(minEur + unit * (maxEur - minEur));
}

function monthNumber(month) {
  const [year, index] = month.split("-").map(Number);
  return year * 12 + index;
}

function addPurchase(rows, customerId, accountId, date, hour, minute, category, merchantId, mccCode, amountEur) {
  const [year, month, day] = date.split("-");
  const time = `${pad2(hour)}:${pad2(minute)}:00`;
  rows.push([
    customerId, accountId, date,
    `${day}${MONTH_CODES[Number(month) - 1]}${year.slice(2)}:${time}`,
    `${date}T${time}`,
    category, -amountEur, 0, "purchase", merchantId, mccCode,
  ]);
}

function purchaseTotal(rows, customerId, month) {
  return rows.reduce(
    (sum, row) =>
      row[0] === customerId && row[8] === "purchase" && row[2].startsWith(month) ? sum - row[6] : sum,
    0,
  );
}

function addBaseline(rows, customerId, accountId, month, seed) {
  BASELINE_TEMPLATES.forEach((template, index) => {
    const day = pad2(2 + index * 2);
    addPurchase(
      rows, customerId, accountId, `${month}-${day}`,
      template.hour, (seed * 7 + index * 11) % 60,
      template.category, template.merchantId, template.mccCode,
      seededAmount(seed + index, template.minEur, template.maxEur),
    );
  });
}

/** One standout per month, so the advice changes as the user moves between months. */
function addTheme(rows, customerId, accountId, month, theme, seed) {
  const day = (offset) => `${month}-${pad2(offset)}`;
  if (theme === "taxi") {
    // Five workday rides: a preventable cost the trainer can point at.
    [2, 5, 9, 12, 16].forEach((date, index) => {
      addPurchase(
        rows, customerId, accountId, day(date), index % 2 ? 17 : 8, 10 + index * 4,
        "Transportation", "MRC-TRN-0037", "4121",
        seededAmount(seed + index * 5, 16, 34),
      );
    });
  } else if (theme === "dining") {
    ["MRC-RES-0010", "MRC-RES-0042", "MRC-RES-0085"].forEach((merchantId, index) => {
      addPurchase(
        rows, customerId, accountId, day(5 + index * 7), 19, 10 + index * 9,
        "Restaurants", merchantId, index === 2 ? "5814" : "5812",
        seededAmount(seed + index * 3, 30, 70),
      );
    });
  } else if (theme === "spree") {
    // One sudden high purchase: clothing in one month, electronics in the other.
    const lifestyle = monthNumber(month) % 2 === 0;
    addPurchase(
      rows, customerId, accountId, day(14), 15, 24,
      lifestyle ? "Lifestyle" : "Home & Tech",
      lifestyle ? "MRC-LIF-0042" : "MRC-HMT-0021",
      lifestyle ? "5651" : "5732",
      seededAmount(seed, 550, 950),
    );
  } else if (theme === "travel") {
    addPurchase(rows, customerId, accountId, day(7), 10, 20, "Travel", "MRC-TRV-0028", "4511", seededAmount(seed, 240, 420));
    addPurchase(rows, customerId, accountId, day(7), 10, 45, "Travel", "MRC-TRV-0003", "7011", seededAmount(seed + 4, 280, 480));
  } else if (theme === "health") {
    addPurchase(rows, customerId, accountId, day(8), 10, 30, "Health", "MRC-HEA-0052", "5912", seededAmount(seed, 22, 55));
    addPurchase(rows, customerId, accountId, day(16), 14, 15, "Health", "MRC-HEA-0017", "8021", seededAmount(seed + 6, 160, 320));
  } else if (theme === "lifestyle") {
    addPurchase(rows, customerId, accountId, day(12), 15, 35, "Lifestyle", "MRC-LIF-0042", "5651", seededAmount(seed, 180, 320));
  }
  // "calm" and "habit" add nothing extra.
}

function applyMonthlyVariety(rows) {
  for (const [month, theme] of Object.entries(DEMO_MONTH_THEMES)) {
    const accountId = rows.find((row) => row[0] === "CUST04457" && row[2].startsWith(month))?.[1];
    if (!accountId) continue;
    const seed = monthNumber(month);
    if (purchaseTotal(rows, "CUST04457", month) < BASELINE_EUR) {
      addBaseline(rows, "CUST04457", accountId, month, seed);
    }
    addTheme(rows, "CUST04457", accountId, month, theme, seed);
  }
  return rows;
}

/** 1 = Monday … 7 = Sunday. */
function isoWeekday(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return ((day + 6) % 7) + 1;
}

/** Sets the time of day on a transaction row (indices 3 = raw timestamp, 4 = ISO). */
function setTimeOfDay(row, hour, minute, second) {
  const [year, month, day] = row[2].split("-");
  row[3] = `${day}${MONTH_CODES[Number(month) - 1]}${year.slice(2)}:${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  row[4] = `${row[2]}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

/** Each date in [start, end] whose ISO weekday is `weekday`. */
function datesOfWeekday(startDate, endDate, weekday) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (isoWeekday(date) === weekday) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function applyDemoHabits(rows) {
  for (const habit of DEMO_HABITS) {
    const accountId = rows.find((row) => row[0] === habit.customerId)?.[1];
    if (!accountId) continue;

    // Existing weekday restaurant purchases become visits to the habit place, at lunch.
    let visit = 0;
    for (const row of rows) {
      if (row[0] !== habit.customerId || row[5] !== habit.category || !row[9]) continue;
      if (row[2] < habit.startDate || row[2] > habit.endDate) continue;
      if (!habit.weekdays.includes(isoWeekday(row[2]))) continue;
      row[9] = habit.merchantId;
      row[10] = habit.mccCode;
      setTimeOfDay(row, habit.lunchHour, (visit * 7) % 50, (visit * 13) % 60);
      visit += 1;
    }

    // One weekly lunch for every week that has no habit visit yet (keeps recent months covered).
    const visited = new Set(
      rows
        .filter((row) => row[0] === habit.customerId && row[9] === habit.merchantId)
        .map((row) => row[2]),
    );
    const [low, high] = habit.amountEur;
    let week = 0;
    for (const date of datesOfWeekday(habit.startDate, habit.endDate, habit.weeklyWeekday)) {
      if (visited.has(date)) continue;
      const amount = -round2(low + (week % 6) * ((high - low) / 5));
      const [raw, iso] = [
        `${date.slice(8, 10)}${MONTH_CODES[Number(date.slice(5, 7)) - 1]}${date.slice(2, 4)}:${pad2(habit.lunchHour)}:${pad2((week * 11) % 50)}:${pad2((week * 17) % 60)}`,
        `${date}T${pad2(habit.lunchHour)}:${pad2((week * 11) % 50)}:${pad2((week * 17) % 60)}`,
      ];
      rows.push([
        habit.customerId, accountId, date, raw, iso,
        habit.category, amount, 0, "purchase", habit.merchantId, habit.mccCode,
      ]);
      visited.add(date);
      week += 1;
    }
  }
  return rows;
}

/**
 * Rebuilds `balance_after_eur` per customer from the opening balance, so added or re-timed rows keep
 * the running balance correct. Rows are then ordered by customer and time, which also fixes `id`
 * order (the table's tiebreaker).
 */
function rebuildBalancesAndOrder(rows) {
  const byCustomer = new Map();
  for (const row of rows) {
    const list = byCustomer.get(row[0]) ?? [];
    list.push(row);
    byCustomer.set(row[0], list);
  }
  for (const list of byCustomer.values()) {
    list.sort((a, b) => (a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : 0));
    let balance = round2(list[0][7] - list[0][6]);
    for (const row of list) {
      balance = round2(balance + row[6]);
      row[7] = balance;
    }
  }
  rows.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : 0));
  return rows;
}

function parseArgs(argv) {
  const args = { customers: DEFAULT_CUSTOMERS, out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--customers" && argv[i + 1]) args.customers = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--out" && argv[i + 1]) args.out = path.resolve(argv[++i]);
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/build-demo-db.mjs [--customers CUST1,CUST2] [--out path.db]");
      process.exit(0);
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const demo = new Set(args.customers);
const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(SCHEMA);

const customers = readCsv(path.join(RAW, "tx_customers_junction.csv"));
const demoCustomers = customers.filter((c) => demo.has(c.customer_id));
const missing = [...demo].filter((id) => !demoCustomers.some((c) => c.customer_id === id));
if (missing.length) throw new Error(`Unknown customer id(s): ${missing.join(", ")}`);

const insert = (table, cols, rows) => {
  if (!rows.length) return;
  const stmt = db.prepare(
    `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`
  );
  for (const r of rows) stmt.run(r);
  stmt.free();
};

insert("customers", ["customer_id", "customer_postal_code", "customer_age"],
  demoCustomers.map((c) => [c.customer_id, c.customer_postal_code, Number(c.customer_age)]));

const txRows = await streamTransactions(path.join(RAW, "tx_junction_transactions.csv"), demo);
applyMonthlyVariety(txRows);
applyDemoHabits(txRows);
rebuildBalancesAndOrder(txRows);

// Origin's time-machine story: the demo persona keeps less savings on the statement.
for (const row of txRows) {
  const factor = BALANCE_SCALE[row[0]];
  if (factor != null && row[7] != null) row[7] = Math.round(row[7] * factor * 100) / 100;
}

const merchants = collectMerchants(txRows);
const merchantDirectory = [...merchants.values()].sort(
  (a, b) => a.merchantId.localeCompare(b.merchantId) || a.mccCode.localeCompare(b.mccCode),
);
const merchantNames = assignMerchantNames(merchantDirectory);
insert("merchants", ["merchant_id", "mcc_code", "name", "category"],
  merchantDirectory.map(({ merchantId, mccCode, category }) => [
    merchantId, mccCode, merchantNames.get(merchantId + mccCode), category,
  ]));

insert("transactions",
  ["customer_id", "bank_account_id", "tx_date", "tx_timestamp", "tx_ts_iso", "category", "tx_amount_eur", "balance_after_eur", "transaction_type", "merchant_id", "mcc_code"],
  txRows);

const links = readCsv(path.join(RAW, "mtg_tx_customer_link_and_final_mtg_infio.csv"))
  .filter((r) => demo.has(r.customer_id));
insert("mortgage_links",
  ["mortgage_customer_id", "customer_id", "final_decision", "rejection_reason", "final_property_price_eur", "final_requested_loan_eur", "final_equity_amount_eur", "final_collateral_value_eur", "required_monthly_income_eur", "final_loan_to_value"],
  links.map((r) => [
    r.mortgage_customer_id, r.customer_id, r.final_decision, r.rejection_reason,
    num(r.final_property_price_eur), num(r.final_requested_loan_eur), num(r.final_equity_amount_eur),
    num(r.final_collateral_value_eur), num(r.required_monthly_income_eur), num(r.lfinal_loan_to_value),
  ]));

const mortgageIds = new Set(links.map((r) => r.mortgage_customer_id));
const events = readCsv(path.join(RAW, "mtg_negotiation_history.csv"))
  .filter((r) => mortgageIds.has(r.mortgage_customer_id));
insert("mortgage_events",
  ["mortgage_customer_id", "timestamp", "event_type", "property_id", "property_type", "property_price_estimate", "loan_amount", "equity_amount", "collateral_type", "collateral_value", "collateral_status", "decision", "rejection_reason", "expense_type", "expense_amount", "note"],
  events.map((r) => [
    r.mortgage_customer_id, r.timestamp, r.event_type, r.property_id, r.property_type,
    num(r.property_price_estimate), num(r.loan_amount), num(r.equity_amount), r.collateral_type,
    num(r.collateral_value), r.collateral_status, r.decision, r.rejection_reason,
    r.expense_type, num(r.expense_amount), r.note,
  ]));

db.exec(`
  CREATE INDEX idx_tx_customer_date ON transactions(customer_id, tx_date);
  CREATE INDEX idx_tx_customer_ts ON transactions(customer_id, tx_ts_iso);
  CREATE INDEX idx_events_mortgage ON mortgage_events(mortgage_customer_id);
  CREATE INDEX idx_links_customer ON mortgage_links(customer_id);
`);

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, Buffer.from(db.export()));
db.close();

const size = fs.statSync(args.out).size;
console.log(`Wrote ${path.relative(ROOT, args.out)} (${(size / 1024).toFixed(1)} KB)`);
console.log(`  customers:       ${demoCustomers.length}`);
console.log(`  merchants:       ${merchants.size}`);
console.log(`  transactions:    ${txRows.length}`);
console.log(`  mortgage_links:  ${links.length}`);
console.log(`  mortgage_events: ${events.length}`);
