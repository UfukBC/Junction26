---
id: T-011
title: Build the yearly spending dashboard, month by month
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: blocked          # todo | in-progress | blocked
priority: high           # high | medium | low
area: frontend           # backend | frontend | infra | design | pitch | other
created: 2026-11-14
created-by: human        # human | ai
---

# T-011: Build the yearly spending dashboard, month by month

## Goal
A dashboard screen where the user sees their spending over a year, month by month, inside the S-mobiili-style app. This is the core screen of the demo.

## Context
- Product idea: [D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md).
- Frontend: [D-0004](../../../decisions/D-0004-mobile-web-app.md), [D-0005](../../../decisions/D-0005-frontend-stack.md). Existing app shell: `src/frontend/src/App.tsx` (home screen, tab bar), styles in `src/frontend/src/styles.css`.
- **Data: use the real data in `src/frontend/public/data/s_pankki-demo.db`** (Michal's demo DB, see [D-0007](../../../decisions/D-0007-browser-sqlite.md)). Read it only through `src/frontend/src/data/database.ts` (`loadDatabase`, `listCustomers`, `getMonthlyFlow`, `getSpendingByCategory`, `getCustomerDashboard`, …); schema and API in `src/frontend/DATA.md`. No mock or hard-coded numbers. `getMonthlyFlow` already returns monthly spending; T-010 fills any gaps (e.g. missing months), but this task can start on the existing functions right away.
- The Bank tab already shows Michal's data screen (`src/frontend/src/screens/DataScreen.tsx`) with a customer switcher; reuse the switcher, and agree with the team where the dashboard lives (its own entry point, or part of the Bank tab).
- The data covers Oct 2024 to Sep 2026: calendar 2025 is the only full year.

## Acceptance criteria
- [ ] An entry point from the home screen opens the dashboard (e.g. a new quick action, the second carousel slide, or a tab), and the user can get back.
- [ ] The dashboard shows the selected demo customer's real data from `s_pankki-demo.db`, and switching customers (reuse the Bank tab's switcher) updates it.
- [ ] A month-by-month chart of spending for the selected year (12 bars), with each month's total readable on tap.
- [ ] The year's total spending and the monthly average are shown above the chart.
- [ ] Switching years works; months without data are shown as empty, not as zero spending.
- [ ] Tapping a month selects it, and the selection is passed on to the category view (T-012).
- [ ] Works at 375–430 px width, matches the app's look (colour tokens in `styles.css`), and `npm run build` passes.

## Out of scope
- The category pie chart (T-012), the questionnaire (T-013), insights (T-014).
- A separate server or API (the demo DB in the browser is the backend).

## Open questions
- "Yearly": calendar years (2024 partial, 2025 full, 2026 Jan–Sep) or the last 12 months up to 2026-09-30?
- Show income next to spending (e.g. a line or paired bars), or spending only?
- Chart library (e.g. Recharts) or hand-made SVG bars? Record the choice as an inbox decision.

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
- 2026-11-14: **on hold.** After seeing the app, Ufuk asked for no annual view: the home screen shows the current month with a category pie instead (built under T-012, [D-0009](../../../docs/decisions/D-0009-home-month-pie.md)). Revisit or close this task.
