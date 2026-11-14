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
  id,
  customer_id AS customerId,
  bank_account_id AS accountId,
  tx_date AS date,
  tx_timestamp AS timestamp,
  tx_ts_iso AS timestampIso,
  category,
  tx_amount_eur AS amountEur,
  balance_after_eur AS balanceAfterEur,
  transaction_type AS type,
  merchant_id AS merchantId,
  mcc_code AS mccCode
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
  const categorySql = options.category ? " AND category = ?" : "";
  const params: SqlValue[] = [customerId, ...rangeParams];
  if (options.category) params.push(options.category);
  params.push(options.limit ?? 50, options.offset ?? 0);
  const direction = options.order === "asc" ? "ASC" : "DESC";
  return query<Transaction>(
    db,
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions
     WHERE customer_id = ?${rangeSql}${categorySql}
     ORDER BY tx_ts_iso ${direction}, id ${direction}
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
    `SELECT merchant_id AS merchantId, -SUM(tx_amount_eur) AS totalEur, COUNT(*) AS count
     FROM transactions
     WHERE customer_id = ? AND tx_amount_eur < 0 AND ${NOT_SPENDING} AND merchant_id IS NOT NULL AND merchant_id <> ''${rangeSql}
     GROUP BY merchant_id
     ORDER BY totalEur DESC
     LIMIT ?`,
    [customerId, ...rangeParams, options.limit ?? 10],
  );
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
