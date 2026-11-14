# Frontend data layer (SQLite in the browser)

> How the S-Pankki dataset reaches the React app with no backend, and how to query it.

**Last verified:** 2026-11-14

## Overview

There is **no backend and no Python**. A slim SQLite database is shipped as a static asset and queried in the browser with [`sql.js`](https://sql.js.org/) (SQLite compiled to WebAssembly).

```
data/raw/*.csv            (gitignored, full challenge dataset)
        │  npm run build:data
        ▼
src/frontend/public/data/s_pankki-demo.db   (committed, ~1.06 MB, 8 demo customers)
        │  fetch() + sql.js
        ▼
src/frontend/src/data/database.ts           (typed query API)
        ▼
src/frontend/src/screens/DataScreen.tsx     (Bank tab UI with customer switcher)
```

The full dataset is **never** bundled: 3.6 M transactions (346 MB CSV, ~585 MB SQLite) cannot be loaded on a phone. The shipped DB is a reproducible subset.

## Files

| Path | Purpose |
|---|---|
| `src/frontend/src/data/database.ts` | sql.js loader + typed query functions. **This is the integration surface.** |
| `src/frontend/src/data/mock.ts` | Static home-screen chrome (bonus card, messages, accounts). Not dataset-derived. |
| `src/frontend/src/data/benchmarks.json` | Public spending benchmarks by income quintile (Statistics Finland, 2022). Generated, see below. |
| `src/frontend/src/data/benchmarks.ts` | Typed accessors for the benchmarks (`QUINTILES`, `getCategoryBenchmark`, …). |
| `src/frontend/src/screens/DataScreen.tsx` | Bank tab: summary, categories, recent transactions, mortgage, customer switcher. |
| `src/frontend/scripts/build-demo-db.mjs` | Node script that builds the slim DB from `data/raw/`. |
| `src/frontend/public/data/s_pankki-demo.db` | Prebuilt demo database (8 customers). |
| `src/frontend/public/sql-wasm.wasm` | sql.js WASM binary, copied from `node_modules/sql.js/dist/`. |
| `data/raw/` | Raw challenge CSVs. Gitignored — download once (see root README). |

## Running

```bash
cd src/frontend
npm install                 # installs sql.js
npm run build:data          # regenerate public/data/s_pankki-demo.db from data/raw/
npm run dev                 # http://localhost:5173
npm run build               # tsc -b && vite build
```

`npm run build:data` requires `data/raw/` to contain the four challenge CSVs (see `docs/references/dataset.md`). If `data/raw/` is missing, skip it: the prebuilt DB is committed, so `npm run dev` still works.

## Demo customers

Defined in `src/frontend/scripts/build-demo-db.mjs` (`DEFAULT_CUSTOMERS`):

| Customer | Age | Mortgage | Outcome | Profile / why it's included |
|---|---|---|---|---|
| `CUST00296` | 53 | `C0115` | rejected (insufficient income) | Saver: 24 monthly investment deposits (11.6k € over two years), no salary sweep. Spends ~2,940 €/month. |
| `CUST00382` | 42 | `C0070` | rejected (insufficient collateral) | **Salary sweep:** moves 60k € of 70k € income to another account, so recorded spending is only ~120 €/month. |
| `CUST04415` | 54 | `C0016` | approved | Large loan (454k €). **Salary sweep:** moves 122k € of 155k € income out, recorded spending ~230 €/month. |
| `CUST04457` | 54 | `C0004` | approved | Typical approved case, spends ~1,950 €/month. |
| `CUST03953` | 20 | – | – | **Young adult:** the most typical spender aged 18–24 (closest to that group's median). Income ~1,880 €/month, spends ~97% of it. |
| `CUST00614` | 42 | – | – | **High earner:** income ~6,350 €/month (97th percentile of all 5,100 customers), yet spends ~98% of it. |
| `CUST00367` | 40 | – | – | **Often negative:** spends ~104% of income; 13% of months end with a negative balance (population average 0.6%). |
| `CUST04506` | 24 | – | – | **Heavy restaurant spender:** 22.5% of spending goes to restaurants (median 7.8%); spends more than earned in 2025. |

The last four were picked for the dashboard (task T-010) from customers with all 24 months of data, no salary sweep and no mortgage, using DuckDB over the full dataset (one-off analysis, not part of the build). Salary-sweep customers (264 of 5,100) have a median recorded spend of 474 €/month vs 2,875 € for everyone else, because most of their money leaves to another account: their dashboards show only a fraction of their real spending.


Add or replace customers:

```bash
node scripts/build-demo-db.mjs --customers CUST04457,CUST00922,CUST02003
node scripts/build-demo-db.mjs --out ../public/data/custom.db --customers CUST04457
```

Every demo customer gets their customer row, all transactions, their mortgage link, and all mortgage events for that application.

## Database schema

`transactions`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | insertion order, chronological per customer |
| `customer_id` | TEXT | FK → `customers.customer_id` |
| `bank_account_id` | TEXT | one account per customer (`ACC000001` style) |
| `tx_date` | TEXT | `YYYY-MM-DD`, the column to use for date ranges |
| `tx_timestamp` | TEXT | raw `03OCT24:09:04:04` — **not sortable** |
| `tx_ts_iso` | TEXT | derived `YYYY-MM-DDTHH:MM:SS`, use this to order |
| `category` | TEXT | Groceries, Restaurants, … |
| `tx_amount_eur` | REAL | signed: negative = money out |
| `balance_after_eur` | REAL | running balance after the transaction |
| `transaction_type` | TEXT | `purchase`, `salary`, `housing_payment`, … |
| `merchant_id` | TEXT | `MRC-GRO-0035` style, empty for non-purchases |
| `mcc_code` | TEXT | MCC, empty for non-purchases |

`customers`: `customer_id` (PK), `customer_postal_code` (keep as TEXT), `customer_age` (INTEGER).

`mortgage_links`: `mortgage_customer_id` (PK), `customer_id`, `final_decision`, `rejection_reason`, `final_property_price_eur`, `final_requested_loan_eur`, `final_equity_amount_eur`, `final_collateral_value_eur`, `required_monthly_income_eur`, `final_loan_to_value`.
The upstream column is misspelled `lfinal_loan_to_value`; it is normalized here to `final_loan_to_value`.

`mortgage_events`: one row per event, ordered by `id`. Columns: `mortgage_customer_id`, `timestamp`, `event_type`, `property_id`, `property_type`, `property_price_estimate`, `loan_amount`, `equity_amount`, `collateral_type`, `collateral_value`, `collateral_status`, `decision`, `rejection_reason`, `expense_type`, `expense_amount`, `note`.

Indexes: `transactions(customer_id, tx_date)`, `transactions(customer_id, tx_ts_iso)`, `mortgage_events(mortgage_customer_id)`, `mortgage_links(customer_id)`.

## Query API (`src/data/database.ts`)

`loadDatabase()` is lazy and cached; the first call fetches the DB and initializes sql.js. Every query function is `async`.

```ts
import {
  listCustomers, getCustomer,
  getTransactions, getTransactionSummary,
  getSpendingByCategory, getMonthlyFlow, getTopMerchants, getBalanceHistory,
  getMortgageLink, getMortgageEvents, getMortgageApplication,
  getCustomerDashboard,
  getYearSpending, listAvailableYears, getDataAsOf, yearRange, monthRange,
} from "../data/database";
```

| Function | Returns |
|---|---|
| `listCustomers()` | `Customer[]` — all demo customers |
| `getCustomer(id)` | `Customer \| null` |
| `getTransactions(id, { startDate?, endDate?, category?, limit?, offset?, order? })` | `Transaction[]`, newest first by default |
| `getTransactionSummary(id, range?)` | `CustomerSummary` — income, spending, net, count, first/last date, latest balance |
| `getSpendingByCategory(id, range?)` | `CategorySpend[]` — total, count, share; sorted by total |
| `getMonthlyFlow(id, range?)` | `MonthlyFlow[]` — `{ month, incomeEur, spendingEur, netEur }` |
| `getTopMerchants(id, { limit?, ...range })` | `MerchantSpend[]` |
| `getBalanceHistory(id, range?)` | `BalancePoint[]`, chronological |
| `getMortgageLink(customerId)` | `MortgageLink \| null` |
| `getMortgageEvents(mortgageId)` | `MortgageEvent[]` |
| `getMortgageApplication(customerId)` | `{ link, events } \| null` |
| `getCustomerDashboard(id, range?)` | everything above in one call |
| `listAvailableYears(id)` | `YearAvailability[]` — `{ year, monthsWithData, isComplete }`, oldest first |
| `getYearSpending(id, year)` | `YearSpending` — always 12 `MonthSpending` rows (Jan–Dec) plus `monthsWithData`, `totalIncomeEur`, `totalSpendingEur`, `averageMonthlySpendingEur` |
| `getDataAsOf()` | last transaction date in the DB (`"2026-09-30"`), the app's "today" |
| `yearRange(year)` / `monthRange("YYYY-MM")` | `DateRange` helpers (not async) for the functions above |

`DateRange = { startDate?: string; endDate?: string }` uses `YYYY-MM-DD` and filters on `tx_date`.

```ts
const dash = await getCustomerDashboard("CUST04457");
const lastMonth = await getTransactions("CUST04457", {
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  limit: 50,
});
```

### Year view (dashboard)

For the yearly dashboard and its pie chart:

```ts
const years = await listAvailableYears("CUST03953");      // 2024: 3 months, 2025: 12 (complete), 2026: 9
const year = await getYearSpending("CUST03953", 2025);     // 12 months, totals, monthly average
const pieYear = await getSpendingByCategory("CUST03953", yearRange(2025));
const pieMonth = await getSpendingByCategory("CUST03953", monthRange("2025-03"));
```

- Months with no transactions have `hasData: false` and `null` amounts, never `0`: in 2024 only Oct–Dec have data, in 2026 only Jan–Sep.
- `averageMonthlySpendingEur` divides by the months that have data, so partial years are not understated.
- The pie for one month adds up exactly to that month's `spendingEur`.
- The dataset ends 2026-09-30; use `getDataAsOf()` instead of the real current date for "this month" or "last 12 months".

### Spending rule

"Spending" excludes transfers and savings: `Salary Sweep` and `Invest Deposit` are cash movements, not consumption (per `docs/references/dataset.md`). This applies to `getTransactionSummary`, `getSpendingByCategory`, `getMonthlyFlow` and `getTopMerchants`. Raw transaction listings still include them.

## UI integration

`App.tsx` renders `<DataScreen />` for the `bank` tab. `DataScreen`:

1. `listCustomers()` → customer switcher chips (horizontal scroll).
2. On selection, `getCustomerDashboard(id)` → KPI cards, category bars, 20 recent transactions, mortgage card.
3. Loading/error states are handled locally; a failed DB load shows the error message.

Styles live in `src/styles.css` under `/* data screen (Bank tab) */`, using the existing S-mobiili tokens (`--green`, `--tint`, …).

## Public spending benchmarks

`src/data/benchmarks.json` holds Statistics Finland's Household Budget Survey 2022 averages (CC BY 4.0), so the demo can compare a customer's spending with the population. It is **not** derived from `data/raw/`; it comes from the public PxWeb API. Full details, schema and category mapping: [BENCHMARKS.md](./BENCHMARKS.md).

```bash
npm run build:benchmarks    # refetch from pxdata.stat.fi and rewrite benchmarks.json
```

Shape: `quintiles` (all + Q1–Q5, with mean household size, consumption units and disposable income) and `categories` (13 main COICOP groups + 52 second-level groups). Each category has `values` per quintile with `eurYearHousehold`, `eurYearPerConsumptionUnit`, `shareOfSpendingPct` and `eurMonthPerConsumptionUnit`.

```ts
import { QUINTILES, getCategoryBenchmark, getSubCategoryBenchmarks } from "../data/benchmarks";

const food = getCategoryBenchmark("01");
food?.values.q1.shareOfSpendingPct; // 17.7
getSubCategoryBenchmarks("07");     // 07.1, 07.2, 07.3, 07.4
```

**Caveats:** quintiles are formed on household disposable income per consumption unit (OECD scale), not gross salary, and the figures are 2022 group means, not cut-off boundaries. Do not compare these with national-accounts food shares (~12.5–12.9%), which use a different methodology.

## Adding a new data view

```ts
// 1. add a typed query in src/data/database.ts
export async function getCashflowByType(customerId: string) { ... }

// 2. call it from a component
const rows = await getCashflowByType("CUST04457");
```

Prefer parameterized statements (`?`) — the module never interpolates values into SQL. Date ranges are validated by construction in `rangeClause`.

## Using the full dataset instead of the subset

Change `DEFAULT_CUSTOMERS` in `scripts/build-demo-db.mjs` (or pass `--customers`). Do **not** ship the full 3.6 M-row DB: sql.js loads the whole file into memory, so a 585 MB DB would freeze a phone. If you need more customers, rebuild with a larger list; a few hundred customers still stays in the low MB range.

## Gotchas

- **Ordering:** never sort by `tx_timestamp` text (`01APR26` sorts before `01AUG25`). Use `tx_ts_iso` (derived in the builder) or `tx_date`.
- **BOM:** the source CSVs start with a UTF-8 BOM; the builder strips it. Keep `utf-8` when regenerating.
- **Date range end:** data ends **2026-09-30**. Relative questions ("last month") need a fixed reference date.
- **Signed amounts:** income categories are always positive, spending always negative.
- **One account per customer:** `customer_id` ↔ `bank_account_id` is 1:1.
- **Empty merchant/MCC:** all non-purchase rows plus ~22% of purchases have no merchant/MCC.
- **Mortgage decisions carry forward:** read the outcome from `mortgage_links` (or the `loan_decision` event), not from stray `decision` values on later events.
- **`NODE_ENV=production`:** npm skips devDependencies; use `NODE_ENV=development npm install --include=dev` if `vite`/`tsc` are missing.

## Verification

```bash
cd src/frontend
npm run build                       # type-check + production build
npm run build:data                  # prints row counts for the demo DB
```

The built app serves `/data/s_pankki-demo.db` and `/sql-wasm.wasm` from `public/`.
