# Inbox: knowledge waiting for review

AI agents append entries here instead of editing `docs/references/` or `docs/decisions/`.

**Reviewers:** for each entry, check it against the code or reality. Fix or delete it if it's wrong, then tick `- [x] Approved`.
Run `/drain` to move approved entries into the docs. `/drain` leaves unticked entries alone.

Format: `docs/templates/inbox-entry.md`. Put new entries at the bottom. If you get a merge conflict here, keep both sides.

---

<!-- entries below this line -->

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

---

### I-20261114-demo-db-eight-customers

- [ ] Approved
- **Type:** reference
- **Target:** `docs/references/frontend-data.md` (existing, replace the "Demo DB" paragraph and extend the "API" paragraph)
- **Task:** T-010
- **Author:** AI
- **Evidence:** `npm run build:data` output (8 customers, 5,191 transactions, 4 mortgage links, 79 events, 1,060 KB); `src/frontend/scripts/build-demo-db.mjs` (`DEFAULT_CUSTOMERS`); `src/frontend/src/data/database.ts` (year dashboard section); Node check of the new functions against the DB (missing months null, Feb 2024 = 29 days, monthly category totals = monthly spending)

**Demo DB:** 8 customers, 5,191 transactions, 4 mortgage links, 79 events (~1.06 MB). Michal's four mortgage applicants (CUST00296, CUST00382, CUST04415, CUST04457) plus four dashboard profiles from T-010: young adult CUST03953, high earner CUST00614, often negative CUST00367, heavy restaurant spender CUST04506. Defaults live in `DEFAULT_CUSTOMERS` in `scripts/build-demo-db.mjs`; reasons per customer in `src/frontend/DATA.md`. CUST00382 and CUST04415 sweep their salary to another account, so their recorded spending is only ~120–230 €/month.

**API additions (year dashboard):** `listAvailableYears(id)` (years with `monthsWithData`, `isComplete`), `getYearSpending(id, year)` (always 12 months, missing months `hasData: false` with null amounts, totals, average over months with data), `getDataAsOf()` (last date in the DB, "2026-09-30"), `yearRange(year)` / `monthRange("YYYY-MM")` (DateRange helpers for `getSpendingByCategory` etc.).

---

### I-20261114-salary-sweep-hides-spending

- [ ] Approved
- **Type:** reference
- **Target:** `docs/references/dataset.md` (existing, section "Traps")
- **Task:** T-010
- **Author:** AI
- **Evidence:** DuckDB over the full `tx_junction_transactions.csv` (per-customer monthly averages, spending excludes Salary Sweep and Invest Deposit): sweep customers n=264, median spending 474 €/month, median spending/income 0.11; others n=4,836, median 2,875 €/month, ratio 0.92. Demo DB: CUST00382 sweeps 60,276 € of 70,488 € income, CUST04415 121,763 € of 154,667 €.

- **Salary-sweep customers look like almost-non-spenders.** The 264 customers with `salary_sweep` move most of each salary to another account within days, so only ~11% of their income shows up as spending (median 474 €/month vs 2,875 € for the other 4,836). Their low spending, restaurant shares and negative-balance rates are not comparable to other customers: exclude them when picking typical profiles or computing benchmarks, or label them as "partial view" in the UI.
