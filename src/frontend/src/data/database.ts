import initSqlJs, { type Database, type SqlValue } from "sql.js";

/* ------------------------------------------------------------------ types */

export interface Customer {
  id: string;
  postalCode: string;
  age: number;
}

export interface Transaction {
  id: number;
  customerId: string;
  accountId: string | null;
  date: string;
  timestamp: string | null;
  timestampIso: string | null;
  category: string;
  amountEur: number;
  balanceAfterEur: number;
  type: string;
  merchantId: string | null;
  /** Human-readable place name from the `merchants` table, when the merchant is known. */
  merchantName: string | null;
  mccCode: string | null;
}

export interface CustomerSummary {
  incomeEur: number;
  spendingEur: number;
  netEur: number;
  transactionCount: number;
  firstDate: string | null;
  lastDate: string | null;
  latestBalanceEur: number | null;
}

export interface CategorySpend {
  category: string;
  totalEur: number;
  count: number;
  share: number;
}

export interface MonthlyFlow {
  month: string;
  incomeEur: number;
  spendingEur: number;
  netEur: number;
}

export interface MerchantSpend {
  merchantId: string;
  /** Human-readable place name from the `merchants` table (`merchantId` when unknown). */
  name: string;
  totalEur: number;
  count: number;
}

export interface BalancePoint {
  date: string;
  timestampIso: string | null;
  balanceEur: number;
  amountEur: number;
}

export interface MortgageLink {
  mortgageId: string;
  customerId: string;
  decision: string | null;
  rejectionReason: string | null;
  propertyPriceEur: number | null;
  loanEur: number | null;
  equityEur: number | null;
  collateralEur: number | null;
  requiredMonthlyIncomeEur: number | null;
  loanToValue: number | null;
}

export interface MortgageEvent {
  timestamp: string | null;
  eventType: string;
  propertyId: string | null;
  propertyType: string | null;
  propertyPriceEur: number | null;
  loanAmountEur: number | null;
  equityAmountEur: number | null;
  collateralType: string | null;
  collateralValueEur: number | null;
  collateralStatus: string | null;
  decision: string | null;
  rejectionReason: string | null;
  expenseType: string | null;
  expenseAmountEur: number | null;
  note: string | null;
}

export interface MortgageApplication {
  link: MortgageLink;
  events: MortgageEvent[];
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface TransactionQuery extends DateRange {
  category?: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

export interface PurchaseCategory {
  name: string;
  count: number;
  valueEur: number;
}

export interface MonthSlice {
  name: "Fixed" | "Everyday" | "Left";
  detail: string;
  valueEur: number;
  categories?: PurchaseCategory[];
}

export interface MonthStory {
  month: string;
  asOf: string;
  balanceEur: number;
  incomeEur: number;
  incomeDetail: string;
  calm: boolean;
  slices: MonthSlice[];
}

export interface CustomerDashboard {
  customer: Customer;
  summary: CustomerSummary;
  categories: CategorySpend[];
  monthly: MonthlyFlow[];
  merchants: MerchantSpend[];
  recentTransactions: Transaction[];
  balanceHistory: BalancePoint[];
  mortgage: MortgageApplication | null;
}

/* ---------------------------------------------------------------- loading */

const DB_URL = `${import.meta.env.BASE_URL}data/s_pankki-demo.db`;
const WASM_URL = `${import.meta.env.BASE_URL}sql-wasm.wasm`;

let databasePromise: Promise<Database> | null = null;

/** Load (once) the slim SQLite file into the browser via sql.js. */
export function loadDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => WASM_URL });
      const response = await fetch(DB_URL);
      if (!response.ok) {
        throw new Error(`Could not load ${DB_URL}: ${response.status} ${response.statusText}`);
      }
      return new SQL.Database(new Uint8Array(await response.arrayBuffer()));
    })();
  }
  return databasePromise;
}

/* ----------------------------------------------------------------- helpers */

function query<T>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
    return rows;
  } finally {
    stmt.free();
  }
}

function queryOne<T>(db: Database, sql: string, params: SqlValue[] = []): T | null {
  return query<T>(db, sql, params)[0] ?? null;
}

function rangeClause(range?: DateRange): { sql: string; params: SqlValue[] } {
  const clauses: string[] = [];
  const params: SqlValue[] = [];
  if (range?.startDate) {
    clauses.push("tx_date >= ?");
    params.push(range.startDate);
  }
  if (range?.endDate) {
    clauses.push("tx_date <= ?");
    params.push(range.endDate);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

const CUSTOMER_COLUMNS = `
  customer_id AS id,
  customer_postal_code AS postalCode,
  customer_age AS age
`;

// Transfers/savings are cash movements, not spending (see docs/references/dataset.md).
const NON_SPENDING_CATEGORIES = `'Salary Sweep', 'Invest Deposit'`;
const NOT_SPENDING = `category NOT IN (${NON_SPENDING_CATEGORIES})`;

const TRANSACTION_COLUMNS = `
  t.id,
  t.customer_id AS customerId,
  t.bank_account_id AS accountId,
  t.tx_date AS date,
  t.tx_timestamp AS timestamp,
  t.tx_ts_iso AS timestampIso,
  t.category,
  t.tx_amount_eur AS amountEur,
  t.balance_after_eur AS balanceAfterEur,
  t.transaction_type AS type,
  t.merchant_id AS merchantId,
  m.name AS merchantName,
  t.mcc_code AS mccCode
`;

/* ------------------------------------------------------------ customers */

export async function listCustomers(): Promise<Customer[]> {
  const db = await loadDatabase();
  return query<Customer>(db, `SELECT ${CUSTOMER_COLUMNS} FROM customers ORDER BY customer_id`);
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const db = await loadDatabase();
  return queryOne<Customer>(db, `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE customer_id = ?`, [customerId]);
}

/* ---------------------------------------------------------- transactions */

export async function getTransactions(
  customerId: string,
  options: TransactionQuery = {},
): Promise<Transaction[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(options);
  const categorySql = options.category ? " AND t.category = ?" : "";
  const params: SqlValue[] = [customerId, ...rangeParams];
  if (options.category) params.push(options.category);
  params.push(options.limit ?? 50, options.offset ?? 0);
  const direction = options.order === "asc" ? "ASC" : "DESC";
  return query<Transaction>(
    db,
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions t
     LEFT JOIN merchants m ON m.merchant_id = t.merchant_id AND m.mcc_code = t.mcc_code
     WHERE t.customer_id = ?${rangeSql}${categorySql}
     ORDER BY t.tx_ts_iso ${direction}, t.id ${direction}
     LIMIT ? OFFSET ?`,
    params,
  );
}

export async function getTransactionSummary(
  customerId: string,
  range?: DateRange,
): Promise<CustomerSummary> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  const aggregate = queryOne<Omit<CustomerSummary, "netEur" | "latestBalanceEur">>(
    db,
    `SELECT
       COALESCE(SUM(CASE WHEN tx_amount_eur > 0 THEN tx_amount_eur ELSE 0 END), 0) AS incomeEur,
       COALESCE(-SUM(CASE WHEN tx_amount_eur < 0 AND ${NOT_SPENDING} THEN tx_amount_eur ELSE 0 END), 0) AS spendingEur,
       COUNT(*) AS transactionCount,
       MIN(tx_date) AS firstDate,
       MAX(tx_date) AS lastDate
     FROM transactions
     WHERE customer_id = ?${rangeSql}`,
    [customerId, ...rangeParams],
  );
  const latest = queryOne<{ balance: number | null }>(
    db,
    `SELECT balance_after_eur AS balance
     FROM transactions
     WHERE customer_id = ?
     ORDER BY tx_ts_iso DESC, id DESC
     LIMIT 1`,
    [customerId],
  );
  const incomeEur = aggregate?.incomeEur ?? 0;
  const spendingEur = aggregate?.spendingEur ?? 0;
  return {
    incomeEur,
    spendingEur,
    netEur: incomeEur - spendingEur,
    transactionCount: aggregate?.transactionCount ?? 0,
    firstDate: aggregate?.firstDate ?? null,
    lastDate: aggregate?.lastDate ?? null,
    latestBalanceEur: latest?.balance ?? null,
  };
}

/* -------------------------------------------------------------- analysis */

export async function getSpendingByCategory(
  customerId: string,
  range?: DateRange,
): Promise<CategorySpend[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  const rows = query<Omit<CategorySpend, "share">>(
    db,
    `SELECT category, -SUM(tx_amount_eur) AS totalEur, COUNT(*) AS count
     FROM transactions
     WHERE customer_id = ? AND tx_amount_eur < 0 AND ${NOT_SPENDING}${rangeSql}
     GROUP BY category
     ORDER BY totalEur DESC`,
    [customerId, ...rangeParams],
  );
  const total = rows.reduce((sum, row) => sum + row.totalEur, 0);
  return rows.map((row) => ({ ...row, share: total > 0 ? row.totalEur / total : 0 }));
}

export async function getMonthlyFlow(
  customerId: string,
  range?: DateRange,
): Promise<MonthlyFlow[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  const rows = query<Omit<MonthlyFlow, "netEur">>(
    db,
    `SELECT
       substr(tx_date, 1, 7) AS month,
       SUM(CASE WHEN tx_amount_eur > 0 THEN tx_amount_eur ELSE 0 END) AS incomeEur,
       -SUM(CASE WHEN tx_amount_eur < 0 AND ${NOT_SPENDING} THEN tx_amount_eur ELSE 0 END) AS spendingEur
     FROM transactions
     WHERE customer_id = ?${rangeSql}
     GROUP BY month
     ORDER BY month`,
    [customerId, ...rangeParams],
  );
  return rows.map((row) => ({ ...row, netEur: row.incomeEur - row.spendingEur }));
}

export async function getTopMerchants(
  customerId: string,
  options: DateRange & { limit?: number } = {},
): Promise<MerchantSpend[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(options);
  return query<MerchantSpend>(
    db,
    `SELECT
       t.merchant_id AS merchantId,
       COALESCE(MAX(m.name), t.merchant_id) AS name,
       -SUM(t.tx_amount_eur) AS totalEur,
       COUNT(*) AS count
     FROM transactions t
     LEFT JOIN merchants m ON m.merchant_id = t.merchant_id AND m.mcc_code = t.mcc_code
     WHERE t.customer_id = ? AND t.tx_amount_eur < 0 AND ${NOT_SPENDING} AND t.merchant_id IS NOT NULL AND t.merchant_id <> ''${rangeSql}
     GROUP BY t.merchant_id
     ORDER BY totalEur DESC
     LIMIT ?`,
    [customerId, ...rangeParams, options.limit ?? 10],
  );
}

/** One unusually large purchase, for spotting a spree or a one-off splurge. */
export interface LargePurchase {
  date: string;
  name: string;
  category: string;
  amountEur: number;
}

/** This customer's biggest purchases in a period, largest first. */
export async function getLargestPurchases(
  customerId: string,
  options: DateRange & { limit?: number; minEur?: number } = {},
): Promise<LargePurchase[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(options);
  const minSql = options.minEur !== undefined ? " AND -t.tx_amount_eur >= ?" : "";
  const params: SqlValue[] = [customerId, ...rangeParams];
  if (options.minEur !== undefined) params.push(options.minEur);
  params.push(options.limit ?? 3);
  return query<LargePurchase>(
    db,
    `SELECT
       t.tx_date AS date,
       COALESCE(m.name, t.merchant_id, t.category) AS name,
       t.category AS category,
       -t.tx_amount_eur AS amountEur
     FROM transactions t
     LEFT JOIN merchants m ON m.merchant_id = t.merchant_id AND m.mcc_code = t.mcc_code
     WHERE t.customer_id = ? AND t.transaction_type = 'purchase' AND t.tx_amount_eur < 0${rangeSql}${minSql}
     ORDER BY t.tx_amount_eur ASC
     LIMIT ?`,
    params,
  );
}

/** One customer's spend in one purchase category in one month. */
export interface CategoryMonthSpend {
  month: string;
  totalEur: number;
  count: number;
}

/** Monthly history of one purchase category, oldest first. */
export async function getCategoryMonthlySpending(
  customerId: string,
  category: string,
): Promise<CategoryMonthSpend[]> {
  const db = await loadDatabase();
  return query<CategoryMonthSpend>(
    db,
    `SELECT substr(tx_date, 1, 7) AS month, -SUM(tx_amount_eur) AS totalEur, COUNT(*) AS count
     FROM transactions
     WHERE customer_id = ? AND category = ? AND tx_amount_eur < 0 AND transaction_type = 'purchase'
     GROUP BY month
     ORDER BY month`,
    [customerId, category],
  );
}

/** A place this customer visits often, with the day and hour their visits usually fall on. */
export interface PlaceHabit {
  merchantId: string;
  name: string;
  category: string;
  visits: number;
  totalEur: number;
  lastDate: string;
  /** Most common weekday (0 = Sunday … 6 = Saturday); null when no single day stands out. */
  weekday: number | null;
  /** Most common hour of day; null when no single hour stands out. */
  hour: number | null;
}

/**
 * This customer's most-visited purchase places in a period, by visit count (T-0xx demo habits).
 * Only their own purchases; nothing is compared with other customers.
 */
export async function getFrequentPlaces(
  customerId: string,
  options: DateRange & { limit?: number } = {},
): Promise<PlaceHabit[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(options);
  const buckets = query<{
    merchantId: string;
    mccCode: string;
    name: string;
    category: string;
    visits: number;
    totalEur: number;
    lastDate: string;
    weekday: number;
    hour: number;
  }>(
    db,
    `SELECT
       t.merchant_id AS merchantId,
       t.mcc_code AS mccCode,
       COALESCE(MAX(m.name), t.merchant_id) AS name,
       t.category AS category,
       COUNT(*) AS visits,
       -SUM(t.tx_amount_eur) AS totalEur,
       MAX(t.tx_date) AS lastDate,
       CAST(strftime('%w', t.tx_date) AS INTEGER) AS weekday,
       CAST(substr(t.tx_ts_iso, 12, 2) AS INTEGER) AS hour
     FROM transactions t
     LEFT JOIN merchants m ON m.merchant_id = t.merchant_id AND m.mcc_code = t.mcc_code
     WHERE t.customer_id = ? AND t.transaction_type = 'purchase'
       AND t.merchant_id IS NOT NULL AND t.merchant_id <> '' AND t.tx_ts_iso IS NOT NULL${rangeSql}
     GROUP BY t.merchant_id, t.mcc_code, weekday, hour`,
    [customerId, ...rangeParams],
  );

  const places = new Map<string, PlaceHabit & { weekdayCounts: Map<number, number>; hourCounts: Map<number, number> }>();
  for (const bucket of buckets) {
    // A merchant can appear under several MCCs; each (merchant, MCC) is its own place.
    const placeKey = `${bucket.merchantId}|${bucket.mccCode}`;
    let place = places.get(placeKey);
    if (!place) {
      place = {
        merchantId: bucket.merchantId,
        name: bucket.name,
        category: bucket.category,
        visits: 0,
        totalEur: 0,
        lastDate: bucket.lastDate,
        weekday: null,
        hour: null,
        weekdayCounts: new Map(),
        hourCounts: new Map(),
      };
      places.set(placeKey, place);
    }
    place.visits += bucket.visits;
    place.totalEur += bucket.totalEur;
    if (bucket.lastDate > place.lastDate) place.lastDate = bucket.lastDate;
    place.weekdayCounts.set(bucket.weekday, (place.weekdayCounts.get(bucket.weekday) ?? 0) + bucket.visits);
    place.hourCounts.set(bucket.hour, (place.hourCounts.get(bucket.hour) ?? 0) + bucket.visits);
  }

  const topKey = (counts: Map<number, number>): number | null => {
    let bestKey: number | null = null;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    return bestKey !== null && bestCount > 0 ? bestKey : null;
  };

  return [...places.values()]
    .map(({ weekdayCounts, hourCounts, ...place }) => {
      const weekday = topKey(weekdayCounts);
      const hour = topKey(hourCounts);
      return {
        ...place,
        weekday: weekday !== null && (weekdayCounts.get(weekday) ?? 0) / place.visits >= 0.3 ? weekday : null,
        hour: hour !== null && (hourCounts.get(hour) ?? 0) / place.visits >= 0.35 ? hour : null,
      };
    })
    .sort((a, b) => b.visits - a.visits)
    .slice(0, options.limit ?? 5);
}

export async function getBalanceHistory(
  customerId: string,
  range?: DateRange,
): Promise<BalancePoint[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  return query<BalancePoint>(
    db,
    `SELECT
       tx_date AS date,
       tx_ts_iso AS timestampIso,
       balance_after_eur AS balanceEur,
       tx_amount_eur AS amountEur
     FROM transactions
     WHERE customer_id = ?${rangeSql}
     ORDER BY tx_ts_iso ASC, id ASC`,
    [customerId, ...rangeParams],
  );
}

/* ------------------------------------------------------- year dashboard */
// Added for the dashboard (T-010/T-011/T-012). "Spending" follows the same rule as above:
// negative amounts except Salary Sweep and Invest Deposit. Income = all positive amounts.

/** One calendar month of a year view. Months with no transactions have `hasData: false` and null amounts (not 0). */
export interface MonthSpending {
  month: string; // "2025-03"
  hasData: boolean;
  incomeEur: number | null;
  spendingEur: number | null;
  netEur: number | null;
}

/** A calendar year, always 12 months (January–December), plus totals over the months that have data. */
export interface YearSpending {
  year: number;
  months: MonthSpending[];
  monthsWithData: number;
  totalIncomeEur: number;
  totalSpendingEur: number;
  /** Total spending / months with data; null when the year has no data. */
  averageMonthlySpendingEur: number | null;
}

export interface YearAvailability {
  year: number;
  monthsWithData: number;
  /** True when all 12 months have data (2025 is the only full year in the dataset). */
  isComplete: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** DateRange covering a calendar year: `yearRange(2025)` → 2025-01-01 … 2025-12-31. */
export function yearRange(year: number): DateRange {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

/** DateRange covering one month: `monthRange("2025-02")` → 2025-02-01 … 2025-02-28. */
export function monthRange(month: string): DateRange {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${pad2(lastDay)}` };
}

/** Last transaction date in the demo DB ("2026-09-30"). Use it as "today" for relative periods. */
export async function getDataAsOf(): Promise<string | null> {
  const db = await loadDatabase();
  return queryOne<{ asOf: string | null }>(db, `SELECT MAX(tx_date) AS asOf FROM transactions`)?.asOf ?? null;
}

/** Calendar years in which the customer has transactions, oldest first. */
export async function listAvailableYears(customerId: string): Promise<YearAvailability[]> {
  const db = await loadDatabase();
  const rows = query<{ year: string; monthsWithData: number }>(
    db,
    `SELECT substr(tx_date, 1, 4) AS year, COUNT(DISTINCT substr(tx_date, 1, 7)) AS monthsWithData
     FROM transactions
     WHERE customer_id = ?
     GROUP BY year
     ORDER BY year`,
    [customerId],
  );
  return rows.map((r) => ({ year: Number(r.year), monthsWithData: r.monthsWithData, isComplete: r.monthsWithData === 12 }));
}

/** Month-by-month income and spending for one calendar year, with missing months marked. */
export async function getYearSpending(customerId: string, year: number): Promise<YearSpending> {
  const flows = await getMonthlyFlow(customerId, yearRange(year));
  const byMonth = new Map(flows.map((f) => [f.month, f]));
  const months: MonthSpending[] = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${pad2(i + 1)}`;
    const flow = byMonth.get(month);
    return flow
      ? { month, hasData: true, incomeEur: flow.incomeEur, spendingEur: flow.spendingEur, netEur: flow.netEur }
      : { month, hasData: false, incomeEur: null, spendingEur: null, netEur: null };
  });
  const totalIncomeEur = flows.reduce((sum, f) => sum + f.incomeEur, 0);
  const totalSpendingEur = flows.reduce((sum, f) => sum + f.spendingEur, 0);
  return {
    year,
    months,
    monthsWithData: flows.length,
    totalIncomeEur,
    totalSpendingEur,
    averageMonthlySpendingEur: flows.length ? totalSpendingEur / flows.length : null,
  };
}

/* ---------------------------------------------------------- one month */

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function listMonths(customerId: string): Promise<string[]> {
  const db = await loadDatabase();
  return query<{ month: string }>(
    db,
    `SELECT DISTINCT substr(tx_date, 1, 7) AS month
     FROM transactions
     WHERE customer_id = ?
     ORDER BY month`,
    [customerId],
  ).map((row) => row.month);
}

export async function getMonthStory(customerId: string, month: string): Promise<MonthStory | null> {
  const db = await loadDatabase();
  const rows = query<{ type: string; category: string; count: number; totalEur: number }>(
    db,
    `SELECT transaction_type AS type, category, COUNT(*) AS count, SUM(tx_amount_eur) AS totalEur
     FROM transactions
     WHERE customer_id = ? AND substr(tx_date, 1, 7) = ?
     GROUP BY transaction_type, category`,
    [customerId, month],
  );
  const end = queryOne<{ date: string; balanceEur: number }>(
    db,
    `SELECT tx_date AS date, balance_after_eur AS balanceEur
     FROM transactions
     WHERE customer_id = ? AND substr(tx_date, 1, 7) = ?
     ORDER BY tx_ts_iso DESC, id DESC
     LIMIT 1`,
    [customerId, month],
  );
  if (!end) return null;

  const incomeRows = rows.filter((row) => row.totalEur > 0);
  const incomeEur = round2(incomeRows.reduce((sum, row) => sum + row.totalEur, 0));
  const incomeDetail =
    incomeRows.length > 0 && incomeRows.every((row) => row.category === "Salary") ? "Salary" : "Income";
  const fixedEur = round2(
    -rows
      .filter((row) => row.type === "housing_payment" || row.type === "utilities_payment")
      .reduce((sum, row) => sum + row.totalEur, 0),
  );
  const purchases = rows.filter((row) => row.type === "purchase");
  const everydayEur = round2(-purchases.reduce((sum, row) => sum + row.totalEur, 0));
  const categories = purchases
    .map((row) => ({ name: row.category, count: row.count, valueEur: round2(-row.totalEur) }))
    .sort((a, b) => b.valueEur - a.valueEur);
  const leftEur = round2(incomeEur - fixedEur - everydayEur);

  return {
    month,
    asOf: end.date,
    balanceEur: end.balanceEur,
    incomeEur,
    incomeDetail,
    calm: leftEur >= 0,
    slices: [
      { name: "Fixed", detail: "Housing and utilities", valueEur: fixedEur },
      { name: "Everyday", detail: "Tap for categories", valueEur: everydayEur, categories },
      {
        name: "Left",
        detail: leftEur >= 0 ? "Still in the account" : "Spent past the income",
        valueEur: leftEur,
      },
    ],
  };
}

/* ----------------------------------------------------- purchase timing */
// Added for T-016 (personal spending-time habits). Everything here is about ONE customer; nothing compares
// customers. Only transaction_type = 'purchase' counts (card spending, which has a time of day).

/** One purchase with its time of day, for a single customer. `amountEur` is positive. */
export interface Purchase {
  /** "2026-09-14T21:37:05" */
  timestampIso: string;
  date: string;
  /** 0–23 */
  hour: number;
  /** 0 = Sunday … 6 = Saturday (same as JS Date.getDay) */
  weekday: number;
  amountEur: number;
  category: string;
}

/** Spending of one customer in one (hour of day, weekday) cell. */
export interface TimeCell {
  hour: number;
  weekday: number;
  count: number;
  totalEur: number;
}

/** A customer's purchases in a period, oldest first. */
export async function getPurchases(customerId: string, range?: DateRange): Promise<Purchase[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  return query<Purchase>(
    db,
    `SELECT
       tx_ts_iso AS timestampIso,
       tx_date AS date,
       CAST(substr(tx_ts_iso, 12, 2) AS INTEGER) AS hour,
       CAST(strftime('%w', tx_date) AS INTEGER) AS weekday,
       -tx_amount_eur AS amountEur,
       category
     FROM transactions
     WHERE customer_id = ? AND transaction_type = 'purchase' AND tx_ts_iso IS NOT NULL${rangeSql}
     ORDER BY tx_ts_iso ASC, id ASC`,
    [customerId, ...rangeParams],
  );
}

/** One customer's purchase count and spending by hour of day and weekday (cells with no purchases are omitted). */
export async function getSpendingByHourAndWeekday(customerId: string, range?: DateRange): Promise<TimeCell[]> {
  const db = await loadDatabase();
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  return query<TimeCell>(
    db,
    `SELECT
       CAST(substr(tx_ts_iso, 12, 2) AS INTEGER) AS hour,
       CAST(strftime('%w', tx_date) AS INTEGER) AS weekday,
       COUNT(*) AS count,
       -SUM(tx_amount_eur) AS totalEur
     FROM transactions
     WHERE customer_id = ? AND transaction_type = 'purchase' AND tx_ts_iso IS NOT NULL${rangeSql}
     GROUP BY hour, weekday
     ORDER BY weekday, hour`,
    [customerId, ...rangeParams],
  );
}

/* -------------------------------------------------------------- mortgages */

export async function getMortgageLink(customerId: string): Promise<MortgageLink | null> {
  const db = await loadDatabase();
  return queryOne<MortgageLink>(
    db,
    `SELECT
       mortgage_customer_id AS mortgageId,
       customer_id AS customerId,
       final_decision AS decision,
       rejection_reason AS rejectionReason,
       final_property_price_eur AS propertyPriceEur,
       final_requested_loan_eur AS loanEur,
       final_equity_amount_eur AS equityEur,
       final_collateral_value_eur AS collateralEur,
       required_monthly_income_eur AS requiredMonthlyIncomeEur,
       final_loan_to_value AS loanToValue
     FROM mortgage_links
     WHERE customer_id = ?`,
    [customerId],
  );
}

export async function getMortgageEvents(mortgageId: string): Promise<MortgageEvent[]> {
  const db = await loadDatabase();
  return query<MortgageEvent>(
    db,
    `SELECT
       timestamp,
       event_type AS eventType,
       property_id AS propertyId,
       property_type AS propertyType,
       property_price_estimate AS propertyPriceEur,
       loan_amount AS loanAmountEur,
       equity_amount AS equityAmountEur,
       collateral_type AS collateralType,
       collateral_value AS collateralValueEur,
       collateral_status AS collateralStatus,
       decision,
       rejection_reason AS rejectionReason,
       expense_type AS expenseType,
       expense_amount AS expenseAmountEur,
       note
     FROM mortgage_events
     WHERE mortgage_customer_id = ?
     ORDER BY id ASC`,
    [mortgageId],
  );
}

export async function getMortgageApplication(customerId: string): Promise<MortgageApplication | null> {
  const link = await getMortgageLink(customerId);
  if (!link) return null;
  return { link, events: await getMortgageEvents(link.mortgageId) };
}

/* --------------------------------------------------------------- bundle */

export async function getCustomerDashboard(
  customerId: string,
  range?: DateRange,
): Promise<CustomerDashboard | null> {
  const customer = await getCustomer(customerId);
  if (!customer) return null;
  const [summary, categories, monthly, merchants, recentTransactions, balanceHistory, mortgage] =
    await Promise.all([
      getTransactionSummary(customerId, range),
      getSpendingByCategory(customerId, range),
      getMonthlyFlow(customerId, range),
      getTopMerchants(customerId, { ...range, limit: 5 }),
      getTransactions(customerId, { ...range, limit: 20, order: "desc" }),
      getBalanceHistory(customerId, range),
      getMortgageApplication(customerId),
    ]);
  return { customer, summary, categories, monthly, merchants, recentTransactions, balanceHistory, mortgage };
}
