---
id: T-010
title: Make the browser data layer ready for the dashboard
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: in-progress      # todo | in-progress | blocked
priority: high           # high | medium | low
area: frontend           # backend | frontend | infra | design | pitch | other
created: 2026-11-14
created-by: human        # human | ai
---

# T-010: Make the browser data layer ready for the dashboard

## Goal
The dashboard (T-011, T-012) and insights (T-014) get exactly the numbers they need from the demo database, for demo customers that show interesting, different profiles. The demo DB `s_pankki-demo.db` is the data backend; no separate server.

## Context
- **Data: use the real data in `src/frontend/public/data/s_pankki-demo.db`** (Michal's demo DB, see [D-0007](../../../decisions/D-0007-browser-sqlite.md)). Read it only through `src/frontend/src/data/database.ts` (`loadDatabase`, `listCustomers`, `getMonthlyFlow`, `getSpendingByCategory`, `getCustomerDashboard`, …); schema and API in `src/frontend/DATA.md`. No mock or hard-coded numbers.
- Product idea: [D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md).
- Michal already built the data layer (commit `6655cbf`): a slim SQLite DB (`src/frontend/public/data/s_pankki-demo.db`, 4 customers) queried in the browser with sql.js through `src/frontend/src/data/database.ts`. Read `src/frontend/DATA.md` first; summary in the [frontend-data](../../../references/frontend-data.md) reference; decision: [D-0007](../../../decisions/D-0007-browser-sqlite.md).
- Useful functions already there: `getMonthlyFlow`, `getSpendingByCategory`, `getCustomerDashboard`, `getTransactionSummary`. They already exclude `Salary Sweep` and `Invest Deposit` from spending.
- The 4 current demo customers (CUST00296, CUST00382, CUST04415, CUST04457) are all mortgage applicants, so they don't yet show the range of profiles asked for below. Coordinate changes to the data layer with Michal, who owns it.
- The demo DB is our data backend: no separate server and no Python. The DB builder is a Node script (`npm run build:data`, needs `data/raw/`).
- Data ends 2026-09-30; calendar 2025 is the only full year ([dataset](../../../references/dataset.md)).

## Acceptance criteria
- [x] The dashboard can get, per customer and year: spending per month for all 12 months (months without data marked as missing, not 0), the year total and monthly average, and spending per category for the year or one month. Add or adjust query functions in `database.ts` if the existing ones don't cover this.
- [x] The demo customers cover different profiles (e.g. a young adult, a high earner, someone who often goes negative, a heavy restaurant spender); each pick and why is noted in `DATA.md`. Rebuild with `npm run build:data -- --customers …` if customers change.
- [x] Every new query function is typed and documented in `DATA.md`.
- [x] `npm run build` passes.

## Out of scope
- Charts and screens (T-011, T-012). A separate server or API (the demo DB in the browser is the backend).
- Basket labels (mandatory regular / irregular / everyday): the mapping is in [D-0008](../../../decisions/D-0008-three-basket-mapping.md), but wait until its open points (groceries, fuel, large travel/lifestyle purchases) are settled.

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
- 2026-11-14: re-scoped after rebasing onto Michal's sql.js data layer (was: a Python JSON export, now unnecessary).
- 2026-11-14: started. Plan: add year helpers to `database.ts` (12 months with missing months marked, year totals, available years), pick 4 extra demo customers with distinct profiles from the full data, rebuild the DB, document in `DATA.md`.
- 2026-11-14: done, all criteria met.
  - `database.ts`: new "year dashboard" section with `listAvailableYears`, `getYearSpending` (12 months, missing months `hasData: false` + null), `getDataAsOf`, `yearRange`, `monthRange`. Michal's existing functions are unchanged. Checked in Node against the real DB (esbuild bundle with a `fetch` stub, scratch only): missing months null, Feb 2024 = 29 days, a month's category totals equal its spending, shares sum to 1.
  - Demo DB rebuilt with 8 customers (1.06 MB): Michal's 4 mortgage applicants + CUST03953 (young adult), CUST00614 (high earner), CUST00367 (often negative), CUST04506 (heavy restaurant spender). Picks made with a one-off DuckDB analysis over the full data; reasons in `src/frontend/DATA.md`. `DEFAULT_CUSTOMERS` in `scripts/build-demo-db.mjs` extended (tell Michal).
  - Found: salary-sweep customers show only ~11% of their spending. Michal's CUST00382 and CUST04415 are sweep customers (DATA.md had the sweep label on CUST00296, which is actually a saver with investment deposits); corrected in DATA.md.
  - Inbox: `I-20261114-demo-db-eight-customers`, `I-20261114-salary-sweep-hides-spending`.
