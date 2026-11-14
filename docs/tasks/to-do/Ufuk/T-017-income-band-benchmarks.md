---
id: T-017
title: Compare spending against Statistics Finland income-band benchmarks
owner: Ufuk
status: in-progress
priority: medium
area: frontend
created: 2026-11-14
created-by: ai
---

# T-017: Compare spending against Statistics Finland income-band benchmarks

## Goal
Let users compare their own spending against public Statistics Finland 2022 Household Budget Survey averages for households in their income band (per consumption unit), without comparing against other S-Bank customers.

## Context
- Public benchmarks: `src/frontend/src/data/benchmarks.json` and `BENCHMARKS.md`.
- Data rule ([D-0011](../../../decisions/D-0011-no-other-customers-data.md)): only compare with public Statistics Finland data, never with other customers.
- Implementation in `src/frontend/src/data/benchmarkComparison.ts`, `src/frontend/src/data/usePeerBenchmark.ts`, `src/frontend/src/components/spending/SpendingDetail.tsx`, and `src/frontend/src/data/useAdvice.ts`.

## Acceptance criteria
- [x] COICOP mapping maps the 8 purchase categories without code duplication or car purchases (`071`).
- [x] Income band is chosen using per-consumption-unit disposable income means (`meanDisposableIncomeEur / meanConsumptionUnits`).
- [x] Customer's baseline is computed over 12 months using `getMonthlyFlow` and `getSpendingByCategory` so one anomalous month doesn't shift the band.
- [x] Comparisons are in €/month (not spending shares, because HBS shares include imputed owner-occupier rent).
- [x] Extended view displays peer benchmark comparisons with source attribution.
- [x] Peer facts supplied to Aino (Nemotron) do not use the word "income" so they pass the Everyday advice validator.
- [x] `npm test` and `npm run build` pass.

## Out of scope
- Comparison of Housing and Utilities (fixed bills with imputed rent caveats).
- Live backend API for national comparisons.

## Progress
- 2026-11-14: Created module `benchmarkComparison.ts` with COICOP mapping, per-consumption-unit quintile placement, and euro comparisons. Added `usePeerBenchmark.ts` hook for 12-month baseline. Wired into `SpendingDetail.tsx` and `useAdvice.ts`. 23 unit tests pass.
