---
id: T-018
title: Time machine — project future balances from current habits
owner: Ufuk
status: in-progress
priority: high
area: frontend
created: 2026-11-14
created-by: ai
---

# T-018: Time machine — project future balances from current habits

## Goal
Let the user see, on their own data, how their money could look in the future under different decisions: continue
current habits, invest the monthly surplus, or spend less in one category and save the difference. A custom horizon
(1 month – 20 years) and clear plain-language numbers make the trade-offs obvious, which is the financial-literacy
angle the challenge asks for.

## Context
- Entry card on Home: `src/frontend/src/components/TimeMachineCard.tsx`, rendered in `HomeScreen.tsx`.
- Full screen: `src/frontend/src/screens/TimeMachineScreen.tsx`.
- Pure projection + wording: `src/frontend/src/data/timeMachine.ts` (tests in `timeMachine.test.ts`).
- Baseline loader (composes existing queries, no changes to `database.ts`): `src/frontend/src/data/timeMachineData.ts`.
- Chart: `src/frontend/src/components/TimeMachineChart.tsx`.
- Data rules: personal data only (D-0011); averages from the customer's last ≤6 months; latest balance from
  `getTransactionSummary`. "Spending" keeps the existing rule (excludes Salary Sweep / Invest Deposit).
- Model: each month's balance changes by income − spending plus a signed category adjustment. No investment return:
  the screen is about money kept in the account.

## Acceptance criteria
- [x] Home shows a Time machine card that opens the projection screen.
- [x] Screen shows balance today, average monthly surplus and average spending from the user's own months.
- [x] Timeline presets (1/3/5/10/20 years) plus a custom month slider.
- [x] Two compared lines: continue as now and save more (spending less on one category).
- [x] The spending bar is centred on the user's current average: drag left to spend less, right to spend more.
- [x] Category is selectable from the user's own controllable categories; the signed monthly change updates the projection.
- [x] The extra amount saved over the chosen range is shown as a large, prominent signed number.
- [x] Plain-language summary + a "not financial advice" note.
- [x] `npm test` and `npm run build` pass.

## Out of scope
- Investment returns and other financial products (removed from the first version).
- Inflation adjustment and "today's money" toggles.
- Persisting the chosen scenario; the screen starts from defaults each time.
- Comparing against other customers (forbidden by D-0011).

## Progress
- 2026-11-14: Built the pure projection engine + tests (8 tests), DB baseline loader, SVG chart, full screen,
  Home entry card and styles. Verified `npm test` (17 tests) and `npm run build`.
