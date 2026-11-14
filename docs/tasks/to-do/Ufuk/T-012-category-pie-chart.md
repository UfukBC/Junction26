---
id: T-012
title: Add the expense category pie chart to the dashboard
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: in-progress      # todo | in-progress | blocked
priority: high           # high | medium | low
area: frontend           # backend | frontend | infra | design | pitch | other
created: 2026-11-14
created-by: human        # human | ai
---

# T-012: Add the expense category pie chart to the dashboard

## Goal
The user sees where their money goes: a pie (or donut) chart that splits expenses into categories, for the whole year or the selected month.

## Context
- Product idea: [D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md).
- Builds on the dashboard of T-011.
- **Data: use the real data in `src/frontend/public/data/s_pankki-demo.db`** (Michal's demo DB, see [D-0007](../../../decisions/D-0007-browser-sqlite.md)). Read it only through `src/frontend/src/data/database.ts` (`loadDatabase`, `listCustomers`, `getMonthlyFlow`, `getSpendingByCategory`, `getCustomerDashboard`, …); schema and API in `src/frontend/DATA.md`. No mock or hard-coded numbers. `getSpendingByCategory` gives the category totals for a date range.
- Spending categories in the data (see [dataset](../../../references/dataset.md)): Housing, Utilities, Groceries, Restaurants, Transportation, Entertainment, Health, Home & Tech, Lifestyle, Travel. `Invest Deposit` and `Salary Sweep` are not expenses.
- The challenge's three baskets (mandatory regular / mandatory irregular / everyday leak) are a first mapping in [D-0008](../../../decisions/D-0008-three-basket-mapping.md), with open points.

## Acceptance criteria
- [x] Category amounts come from `s_pankki-demo.db` for the selected customer.
- [ ] A pie/donut chart of expenses by category for the selected period: the whole year by default, or the month selected in T-011 when there is one.
- [x] A legend or list under the chart with each category's amount (€) and share (%), sorted by amount.
- [x] Tapping a slice or a list row highlights the category.
- [x] Colours are distinct, readable on mobile, and fit the app's green palette.
- [x] Small categories (under ~3%) are grouped or still readable; nothing overlaps at 375 px.
- [x] `npm run build` passes.

## Out of scope
- Transaction-level drill-down lists.
- The three-basket view (follow-up once the mapping is decided).

## Open questions
- Should the pie switch between "categories" and "three baskets" once the mapping is decided?

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
- 2026-11-14: built the pie as the home screen's top card (`src/frontend/src/components/MonthSpendingCard.tsx`), replacing the S-mobiili bonus carousel, per Ufuk's feedback: **current month only** (1st to last day of the latest month in the DB, September 2026), no year view. Top 5 categories + grey "Other" (members listed), legend with amount and share, tap to highlight, money in / left below, "See all transactions" opens the Bank tab. Palette validated with the dataviz checker on white (adjacent CVD ΔE >= 9.1, normal-vision >= 17.8; only "fails" grey's chroma, intended for Other). Selected customer is now shared with the Bank tab (`DataScreen` got optional `selectedId`/`onSelect` props). Screenshot-checked at phone size.
- 2026-11-14: second round from Ufuk's feedback: home card is now compact (112 px pie, total, money in, left/over, top 3) with ‹ › month arrows over the months that have data; tapping opens `src/frontend/src/screens/SpendingAnalysis.tsx` (248 px pie, tiles, every category with change vs previous month, "Other" broken down, AI overview placeholder for T-014). Shared code: `components/spending/pie.tsx`, `components/spending/MonthSwitcher.tsx`, `data/useSpending.ts`; App holds the selected customer and month. Verified by driving headless Edge over the DevTools protocol (month arrows, next disabled at Sep 2026, analysis opens on the same month, highlight works).
- Still open: the first criterion (period = whole year by default / month selected in T-011) no longer applies after the "current month only" decision; confirm with the team, then finish.
- 2026-11-14: **superseded by Chamb's pie.** My versions (home card, analysis screen, `components/spending/*`, `data/useSpending.ts`) were removed after Ufuk chose Chamb's `MonthPie` on Home (commit `b72a35e`); they remain in git history (`b446b1b`). The category breakdown now lives in `MonthPie` (Everyday → tap for categories). Check the criteria above against that screen, then finish or close this task.
