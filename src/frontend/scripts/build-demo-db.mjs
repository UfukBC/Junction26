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

const SCHEMA = `
CREATE TABLE customers (
  customer_id          TEXT PRIMARY KEY,
  customer_postal_code TEXT,
  customer_age         INTEGER
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
console.log(`  transactions:    ${txRows.length}`);
console.log(`  mortgage_links:  ${links.length}`);
console.log(`  mortgage_events: ${events.length}`);
