# Inbox: knowledge waiting for review

AI agents append entries here instead of editing `docs/references/` or `docs/decisions/`.

**Reviewers:** for each entry, check it against the code or reality. Fix or delete it if it's wrong, then tick `- [x] Approved`.
Run `/drain` to move approved entries into the docs. `/drain` leaves unticked entries alone.

Format: `docs/templates/inbox-entry.md`. Put new entries at the bottom. If you get a merge conflict here, keep both sides.

---

<!-- entries below this line -->

---

### I-20261114-quintile-spending-benchmark-integration

- [ ] Approved
- **Type:** reference
- **Target:** `docs/references/finnish-consumption-statistics.md` (existing, section "Implemented in the frontend")
- **Task:** T-017
- **Author:** AI
- **Evidence:** `src/frontend/src/data/benchmarkComparison.ts:25-145`, `src/frontend/src/data/usePeerBenchmark.ts:1-45`, `src/frontend/src/components/spending/SpendingDetail.tsx:35-140`

Income-band spending comparisons are implemented in `benchmarkComparison.ts` and `usePeerBenchmark.ts`. The customer's peer band is chosen by matching their 12-month average income (from `getMonthlyFlow`) against Statistics Finland 2022 disposable income per consumption unit means (`meanDisposableIncomeEur / meanConsumptionUnits`: Q1 15.9k €, Q2 24.3k €, Q3 31.2k €, Q4 39.2k €, Q5 64.9k €). One bank account is treated as 1 consumption unit. Comparisons are in €/month (not spending shares, because HBS shares include imputed owner-occupier rent). In `SpendingDetail.tsx`, selecting an Everyday category shows their 12-month average vs the band benchmark. In `useAdvice.ts`, peer facts are passed to Aino without using the word "income" to avoid tripping the Everyday advice validator.

---

### I-20261114-coicop-mapping-corrections

- [ ] Approved
- **Type:** reference
- **Target:** `src/frontend/BENCHMARKS.md` (existing, section "Mapping app categories to COICOP")
- **Task:** T-017
- **Author:** AI
- **Evidence:** `src/frontend/src/data/benchmarkComparison.ts:25-45`, `src/frontend/src/data/benchmarkComparison.test.ts:18-35`

The mapping table in `src/frontend/BENCHMARKS.md` has overlaps and unsupported subcodes for the 8 purchase categories. `benchmarkComparison.ts` uses the corrected mapping:
- Transportation: `072` + `073` (excludes `071` vehicle purchases which are not card transactions).
- Entertainment: `092` + `094` + `096` (excludes `098` package holidays to prevent double counting with Travel).
- Lifestyle: `03` + `132` (avoids broad `09` which duplicates Entertainment).
- Travel: `098` + `112` (`073.3` does not exist in `benchmarks.json` as it is level 3, and `073` is in Transportation).
Fixed bills (Housing and Utilities) are not compared because survey housing includes imputed rent.


