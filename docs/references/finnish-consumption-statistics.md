# Finnish household spending statistics

> Benchmarks for Finnish household spending by category (public statistics).

**Last verified:** 2026-11-14

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
