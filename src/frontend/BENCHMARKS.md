# Spending benchmarks (public statistics)

> Compare a demo customer's spending with Statistics Finland's population averages.
> Data is public, not derived from `data/raw/`.

**Last verified:** 2026-11-14

## What this is

`src/data/benchmarks.json` contains Finnish household spending averages for 2022 by **income quintile**, taken from Statistics Finland's Household Budget Survey (`ktutk`), tables `14pg` and `14qa`.

It is a comparison layer, not part of the S-Pankki dataset: the synthetic transactions stay in `s_pankki-demo.db`, while these figures answer "how does this customer compare with the average Finn in the same income band?".

- **Source:** [Statistics Finland, Households' consumption](https://stat.fi/en/statistics/ktutk) (Household Budget Survey)
- **Tables:** `StatFin ktutk 14pg.px` (consumption by income quintile) and `14qa.px` (background by income quintile)
- **Reference year:** 2022 (latest detailed survey; published 11.4.2024)
- **Licence:** CC BY 4.0
- **API:** <https://pxdata.stat.fi/PXWeb/pxweb/fi/StatFin/StatFin__ktutk/>

## Regenerating

```bash
cd src/frontend
npm run build:benchmarks     # node scripts/build-benchmarks.mjs
```

The script POSTs to the PxWeb API, reads Finnish and English labels, and rewrites `src/data/benchmarks.json`. It needs network access; the output is committed so the app builds offline. The API returns elements in its own order, so the script maps contents by code (`kulu_kt_hk_1_1` etc.) rather than by position.

`npm run build` type-checks the JSON import (`resolveJsonModule` is enabled in `tsconfig.json`).

## Data shape

```ts
import { QUINTILES, getCategoryBenchmark, getMainCategoryBenchmarks, getSubCategoryBenchmarks } from "../data/benchmarks";
```

`quintiles` — `all` plus `q1`–`q5`:

| Field | Meaning |
|---|---|
| `meanHouseholdSize` | Mean persons per household in the quintile |
| `meanConsumptionUnits` | Mean OECD consumption units |
| `meanDisposableIncomeEur` | Mean household disposable income, 2022 euros |

2022 means: Q1 18,796 €, Q2 33,041 €, Q3 44,550 €, Q4 57,642 €, Q5 97,410 €; all households 50,270 €.

`categories` — 13 main COICOP groups (`level: 1`, codes `01`–`13`) and 52 second-level groups (`level: 2`, codes like `011`, `072`, `111`; `parent` points to the main group). Each category has `label.fi`, `label.en`, and `values` keyed by quintile:

| Field | Meaning |
|---|---|
| `eurYearHousehold` | € per household per year |
| `eurYearPerConsumptionUnit` | € per OECD consumption unit per year |
| `shareOfSpendingPct` | Share of household consumption expenditure, % |
| `eurMonthPerConsumptionUnit` | € per consumption unit per month |

Nulls occur where a cell is suppressed or not applicable.

## Mapping app categories to COICOP

The demo DB's categories are coarser than COICOP. Use these as an approximate bridge; document the mapping in the UI so the comparison is explainable.

| App category | COICOP benchmark | Notes |
|---|---|---|
| `Groceries` | `01` | `011` food, `012` non-alcoholic drinks |
| `Restaurants` | `111` | Restaurants, cafés, canteens |
| `Transportation` | `07` | `072` running costs, `073` transport services |
| `Housing` | `041` / `042` | See housing caveat below |
| `Utilities` | `044` + `045` | Water/sewage plus electricity and fuels |
| `Home & Tech` | `05` + `081` | Furnishings/appliances plus ICT devices |
| `Health` | `06` | |
| `Travel` | `098` + `112` + `073.3` | Package holidays, accommodation, air travel |
| `Lifestyle` | `03` + `09` + `132` | Clothing, leisure goods, personal items |
| `Entertainment` | `09` | Especially `092`, `094`, `096` |

Keep the mapping in one place if it becomes code; a mismatch between the two category systems is the most likely source of a misleading comparison.

## Choosing a quintile

The demo DB has **no income column** (`customers` only has postal code and age). Two options:

1. Let the user pick a band explicitly (simplest and honest).
2. Estimate from transactions: sum `salary` + `other_income` over a year, divide by the mean household size or consumption units, then pick the nearest quintile mean. This is approximate because quintiles use **household disposable income per consumption unit**, after taxes and transfers, not gross salary.

The benchmark file exposes only group means, not cut-off boundaries. Do not invent hard thresholds; present it as "closest income band" rather than "your bracket".

## Caveats

- **Quintiles, not salary brackets.** The survey groups households into five equal-size groups by disposable income per consumption unit. There are no public euro salary brackets for consumption categories.
- **Housing includes imputed rents.** COICOP `04` contains actual rents (`041`), imputed rents for owner-occupiers (`042`) and owner-occupied housing (`046`). Transaction-based `Housing` payments will not match it one-to-one; compare like with like or exclude housing/utilities from the comparison.
- **Survey vs national accounts.** The 2022 survey gives food at 14.2% of spending; national accounts give ~12.5% (2024) and 12.9% (2025 preliminary). They use different methods. Use the survey for category benchmarks and national accounts only for the latest year.
- **Small samples.** Detailed second-level categories can be noisy or suppressed within a quintile; prefer main groups for headline comparisons.
- **2022 prices.** The file is a 2022 snapshot. Do not present it as a current cost of living without adjusting.

## Verification

```bash
cd src/frontend
npm run build:benchmarks   # prints category/quintile counts
npm run build              # type-check + production build
```

Sanity checks: all households total 39,808 €/year; food `01` share 14.2% (Q1 17.7%, Q5 11.7%); housing `04` 32.4%; transport `07` 13.9% (Q1 8%, Q5 17%).
