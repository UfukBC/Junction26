# Inbox: knowledge waiting for review

AI agents append entries here instead of editing `docs/references/` or `docs/decisions/`.

**Reviewers:** for each entry, check it against the code or reality. Fix or delete it if it's wrong, then tick `- [x] Approved`.
Run `/drain` to move approved entries into the docs. `/drain` leaves unticked entries alone.

Format: `docs/templates/inbox-entry.md`. Put new entries at the bottom. If you get a merge conflict here, keep both sides.

---

<!-- entries below this line -->

---

### I-20261114-three-basket-draft

- [ ] Approved
- **Type:** decision
- **Target:** new decision
- **Task:** none
- **Author:** AI (draft for discussion, needs team approval)
- **Evidence:** `docs/references/dataset.md` (housing: 1/month, CV 0.03; utilities: ~3/month; purchases ≥500 € concentrated in Home & Tech, Lifestyle, Travel, Health); challenge brief's three baskets

**Title:** First mapping of transactions to the three baskets

**Context:** The brief's pedagogy splits spending into mandatory regular, mandatory irregular, and everyday "slips through your fingers". The data has categories, transaction types and MCC codes, but no basket label.

**Decision (draft):**
- **Mandatory regular:** `housing_payment`, `utilities_payment`.
- **Mandatory irregular:** Health purchases (pharmacy, doctors, dentists: MCC 5912/8011/8021/8099), and large one-off Home & Tech purchases (e.g. appliances; threshold to decide, e.g. ≥ 300 €).
- **Everyday leak:** Restaurants, Entertainment, small Lifestyle and Home & Tech purchases, taxis (MCC 4121).
- **Open:** Groceries and fuel/commuting are needed but frequent: put them in a "regular essentials" view or in everyday? Large Travel/Lifestyle purchases are discretionary but not "everyday"; they may need their own label. Savings (`investment_deposit`) and transfers out (`salary_sweep`) are not spending.

**Alternatives considered:**
- **Let the LLM classify every transaction:** flexible, but slow over 3.6 M rows and not reproducible; better as an explanation layer on top of a rule-based mapping.

**Consequences:** The mapping must be explainable to the user ("why is this in everyday?") and editable, in the MyData spirit.

---

### I-20261114-browser-sqlite

- [ ] Approved
- **Type:** decision
- **Target:** new decision
- **Task:** none
- **Author:** AI
- **Evidence:** `src/frontend/scripts/build-demo-db.mjs`, `src/frontend/src/data/database.ts`, `src/frontend/DATA.md`; `npm run build` passes; Bank tab renders and switches customers in a headless browser.

**Title:** No backend: ship a slim SQLite database and query it in the browser with sql.js

**Context:** The app needs per-customer transaction, spending and mortgage data. The full dataset is 346 MB CSV / ~585 MB SQLite (3.6 M transactions) — too large to bundle or load on a phone. The team decided against Python and any backend service.

**Decision:**
- A Node script (`src/frontend/scripts/build-demo-db.mjs`, using sql.js) builds a **subset** database for a handful of demo customers from `data/raw/`, written to `src/frontend/public/data/s_pankki-demo.db` (~464 KB, committed).
- The app loads it at runtime with sql.js (SQLite compiled to WASM; `public/sql-wasm.wasm`) and queries it through the typed API in `src/frontend/src/data/database.ts`.
- `DataScreen` (Bank tab) exposes a customer switcher over the bundled demo customers.
- The full dataset stays local in `data/raw/` (gitignored). The subset is reproducible with `npm run build:data`.

**Alternatives considered:**
- **Python or Node HTTP API + SQLite:** adds a service to run/deploy; rejected because the team wants no backend for the hackathon.
- **JSON data modules:** smaller to implement but loses SQL and requires hand-written aggregations; rejected in favour of real SQLite queries.
- **Full 585 MB DB in the browser:** sql.js loads the whole file into memory; rejected as unusable on mobile.

**Consequences:**
- Everything runs client-side; the demo works from a static host.
- Only a subset ships. Add customers with `node scripts/build-demo-db.mjs --customers …` and rebuild.
- `.gitignore` had a bare `data/` rule that also ignored `src/frontend/src/data/` (which is why `src/data/mock.ts` was missing from the repo). It is now anchored to `/data/` so frontend data modules can be committed.

---

### I-20261114-frontend-data-layer

- [ ] Approved
- **Type:** reference
- **Target:** `docs/references/frontend-data.md` (new)
- **Task:** none
- **Author:** AI
- **Evidence:** `src/frontend/DATA.md` (full guide), `src/frontend/src/data/database.ts`, `src/frontend/scripts/build-demo-db.mjs`, `src/frontend/public/data/s_pankki-demo.db`

**Title:** Frontend data layer: slim browser SQLite and typed query API

**Pipeline:** `data/raw/*.csv` → `npm run build:data` → `src/frontend/public/data/s_pankki-demo.db` → `src/data/database.ts` (sql.js) → `DataScreen` (Bank tab). No backend.

**Demo DB:** 4 customers (CUST00296, CUST00382, CUST04415, CUST04457), ~2.1k transactions, 4 mortgage links, 79 events. Defaults live in `DEFAULT_CUSTOMERS`.

**Tables:** `customers(customer_id PK, customer_postal_code, customer_age)`; `transactions(id PK, customer_id, bank_account_id, tx_date, tx_timestamp, tx_ts_iso, category, tx_amount_eur, balance_after_eur, transaction_type, merchant_id, mcc_code)`; `mortgage_links(... final_loan_to_value)` (upstream `lfinal_loan_to_value` normalized); `mortgage_events(..., event_type, decision, note, …)`.
**Indexes:** `transactions(customer_id, tx_date)`, `transactions(customer_id, tx_ts_iso)`, `mortgage_events(mortgage_customer_id)`, `mortgage_links(customer_id)`.
**Derived column:** `tx_ts_iso` (`YYYY-MM-DDTHH:MM:SS`) exists because raw `tx_timestamp` (`03OCT24:09:04:04`) does not sort chronologically; order by `tx_ts_iso`.

**API (`src/data/database.ts`, all async):** `loadDatabase`, `listCustomers`, `getCustomer`, `getTransactions`, `getTransactionSummary`, `getSpendingByCategory`, `getMonthlyFlow`, `getTopMerchants`, `getBalanceHistory`, `getMortgageLink`, `getMortgageEvents`, `getMortgageApplication`, `getCustomerDashboard`. Date ranges are `YYYY-MM-DD` on `tx_date`; values are always bound as `?` parameters.

**Spending rule:** `Salary Sweep` and `Invest Deposit` are transfers/savings, not spending, and are excluded from spending/category/monthly/top-merchant aggregates. Raw listings still include them.

**Gotchas:** data ends 2026-09-30; amounts are signed; one account per customer; merchant/MCC empty on all non-purchases plus ~22% of purchases; mortgage `decision` is carried forward, so read the outcome from `mortgage_links`; source CSVs have a UTF-8 BOM (builder strips it). Full dataset must never be committed.

---

### I-20261114-finnish-consumption-statistics

- [ ] Approved
- **Type:** reference
- **Target:** `docs/references/finnish-consumption-statistics.md` (new)
- **Task:** none
- **Author:** AI
- **Evidence:** Statistics Finland PxWeb API query run 2026-11-14, `POST https://pxdata.stat.fi/PXWeb/api/v1/fi/StatFin/ktutk/14ph.px` (element selections: `timeperiod_y=2022`, main COICOP codes `0,01…13`, `elinvaihe=SSS`, contents `kulu_kt_hk_1_1` + `kulu_pro_kt_hk_1_1`); [stat.fi/fi/tilasto/ktutk](https://stat.fi/fi/tilasto/ktutk); [PTT 18.6.2026](https://www.ptt.fi/ruokamenojen-kasvu-jatkui-muuta-kulutusta-vahvempana-vuonna-2025/)

**Title:** Benchmarks for Finnish household spending by category (public statistics)

**Why:** The S-Pankki dataset is synthetic, so public averages are useful as a sanity check / comparison layer ("your groceries are 18% of spending vs 14% average"). All sources below are free and CC BY 4.0 (Statistics Finland), English available.

**Statistics Finland — Household Budget Survey (`ktutk`), latest 2022, published 11.4.2024.** Sample survey, irregular. Average household: **39,808 €/year** (~3,317 €/month). Main COICOP2018 groups, all households, 2022 (euro/household/year and share):

| COICOP | Group | €/year | % |
|---|---|---:|---:|
| 01 | Food and non-alcoholic beverages | 5,646 | 14.2 |
| 02 | Alcoholic beverages and tobacco | 736 | 1.9 |
| 03 | Clothing and footwear | 1,683 | 4.2 |
| 04 | Housing, water, electricity, gas, other fuels | 12,910 | 32.4 |
| 05 | Furnishings, household equipment, routine upkeep | 1,644 | 4.1 |
| 06 | Health | 1,420 | 3.6 |
| 07 | Transport | 5,514 | 13.9 |
| 08 | Information and communication | 1,559 | 3.9 |
| 09 | Culture and leisure | 2,565 | 6.4 |
| 10 | Education | 146 | 0.4 |
| 11 | Restaurants and accommodation | 1,529 | 3.8 |
| 12 | Insurance and financial services | 1,786 | 4.5 |
| 13 | Personal hygiene, social protection, other | 1,880 | 4.7 |

The same PxWeb table (`14ph.px`) also breaks figures down by household type, income quintile (`14pg.px`), age (`14q4.px`), region, etc., and gives per-consumption-unit values. `14pg` example: food share 18% in the lowest income quintile vs 12% in the highest, transport 8% vs 17%.

**Income filter is quintiles only — there are no euro salary brackets.** Quintiles are formed on household disposable income per consumption unit (OECD scale), not gross salary. Mean disposable income per household in 2022 (`14qa.px`): Q1 18,796 €, Q2 33,041 €, Q3 44,550 €, Q4 57,642 €, Q5 97,410 €; all households 50,270 €. These are means, not cut-off boundaries. `14qu.px` additionally splits consumption by socio-economic status (employee, worker, entrepreneur, pensioner, student…) as a salary-level proxy. Eurostat `hbs_str_t223` also uses quintiles, not brackets.

**Caveat — two different "food shares":** the 2022 survey gives 14.2% (HBS, COICOP2018), while national accounts give ~12.5% (2024) and 12.9% (2025 preliminary). Use the HBS for category benchmarks; use national accounts for the latest year. Do not mix them in one comparison.

**Other public sources:**
- National accounts (Tilastokeskus) — annual COICOP household consumption up to preliminary 2025; food spend 17.6 bn € in 2025.
- Eurostat Household Budget Survey (`hbs`) and `tec00134` — EU-comparable COICOP shares; Finland included. Microdata available on request.
- Bank of Finland — household credit/debt and consumption-loan stock (28.0 bn € at Q1 2025).
- PTT / Luke — food-specific spend and consumption trends.
- Statistics Finland income distribution + indebtedness statistics for income/wealth context.

**Access:** PxWeb UI at <https://pxdata.stat.fi/PXWeb/pxweb/fi/StatFin/StatFin__ktutk/> and a JSON API (POST a selection body, `format: json-stat2`) that can be used to generate benchmark JSON at build time.

**Implemented in the frontend:** `src/frontend/scripts/build-benchmarks.mjs` (regenerate with `npm run build:benchmarks`), output `src/frontend/src/data/benchmarks.json`, typed accessors in `src/frontend/src/data/benchmarks.ts`, and documentation in `src/frontend/BENCHMARKS.md`.
