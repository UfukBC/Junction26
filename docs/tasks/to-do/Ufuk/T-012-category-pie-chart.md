---
id: T-012
title: Add the expense category pie chart to the dashboard
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: todo             # todo | in-progress | blocked
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
- [ ] Category amounts come from `s_pankki-demo.db` for the selected customer.
- [ ] A pie/donut chart of expenses by category for the selected period: the whole year by default, or the month selected in T-011 when there is one.
- [ ] A legend or list under the chart with each category's amount (€) and share (%), sorted by amount.
- [ ] Tapping a slice or a list row highlights the category.
- [ ] Colours are distinct, readable on mobile, and fit the app's green palette.
- [ ] Small categories (under ~3%) are grouped or still readable; nothing overlaps at 375 px.
- [ ] `npm run build` passes.

## Out of scope
- Transaction-level drill-down lists.
- The three-basket view (follow-up once the mapping is decided).

## Open questions
- Should the pie switch between "categories" and "three baskets" once the mapping is decided?

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
