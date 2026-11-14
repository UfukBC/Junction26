# Frontend data layer

> Frontend data layer: slim browser SQLite and typed query API.

**Last verified:** 2026-11-14

**Pipeline:** `data/raw/*.csv` → `npm run build:data` → `src/frontend/public/data/s_pankki-demo.db` → `src/data/database.ts` (sql.js) → `DataScreen` (Bank tab). No backend.

**Demo DB:** 9 customers, 6,320 transactions, 4 mortgage links, 79 events (~1.25 MB). Michal's four mortgage applicants (CUST00296, CUST00382, CUST04415, CUST04457) plus four dashboard profiles from T-010: young adult CUST03953, high earner CUST00614, often negative CUST00367, heavy restaurant spender CUST04506, and (T-016) late-evening big spender CUST03172. Defaults live in `DEFAULT_CUSTOMERS` in `scripts/build-demo-db.mjs`; reasons per customer in `src/frontend/DATA.md`. CUST00382 and CUST04415 sweep their salary to another account, so their recorded spending is only ~120–230 €/month.

**Tables:** `customers(customer_id PK, customer_postal_code, customer_age)`; `transactions(id PK, customer_id, bank_account_id, tx_date, tx_timestamp, tx_ts_iso, category, tx_amount_eur, balance_after_eur, transaction_type, merchant_id, mcc_code)`; `mortgage_links(... final_loan_to_value)` (upstream `lfinal_loan_to_value` normalized); `mortgage_events(..., event_type, decision, note, …)`.
**Indexes:** `transactions(customer_id, tx_date)`, `transactions(customer_id, tx_ts_iso)`, `mortgage_events(mortgage_customer_id)`, `mortgage_links(customer_id)`.
**Derived column:** `tx_ts_iso` (`YYYY-MM-DDTHH:MM:SS`) exists because raw `tx_timestamp` (`03OCT24:09:04:04`) does not sort chronologically; order by `tx_ts_iso`.

**API (`src/data/database.ts`, all async):** `loadDatabase`, `listCustomers`, `getCustomer`, `getTransactions`, `getTransactionSummary`, `getSpendingByCategory`, `getMonthlyFlow`, `getTopMerchants`, `getBalanceHistory`, `getMortgageLink`, `getMortgageEvents`, `getMortgageApplication`, `getCustomerDashboard`. Date ranges are `YYYY-MM-DD` on `tx_date`; values are always bound as `?` parameters.

**API additions (year dashboard):** `listAvailableYears(id)` (years with `monthsWithData`, `isComplete`), `getYearSpending(id, year)` (always 12 months, missing months `hasData: false` with null amounts, totals, average over months with data), `getDataAsOf()` (last date in the DB, "2026-09-30"), `yearRange(year)` / `monthRange("YYYY-MM")` (DateRange helpers for `getSpendingByCategory` etc.).

**Spending rule:** `Salary Sweep` and `Invest Deposit` are transfers/savings, not spending, and are excluded from spending/category/monthly/top-merchant aggregates. Raw listings still include them.

**Gotchas:** data ends 2026-09-30; amounts are signed; one account per customer; merchant/MCC empty on all non-purchases plus ~22% of purchases; mortgage `decision` is carried forward, so read the outcome from `mortgage_links`; source CSVs have a UTF-8 BOM (builder strips it). Full dataset must never be committed.

## Segment advice

**Segment advice key:** `XAI_API_KEY` in the environment or in `src/frontend/.env` (gitignored). The Vite dev server reads it with `loadEnv` and calls `POST https://api.x.ai/v1/responses` with model `grok-4.7` and `store: false`. The key is not sent to the browser.

`motion-graphic.html` posts `{ month, segment, brief }` to `/api/segment-advice` only when the page is served by that dev server. With no key the route returns 503 and the graphic keeps the trainer lines written in the file. Opening the HTML with `file://` does not call the API.
