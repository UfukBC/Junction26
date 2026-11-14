---
id: T-013
title: Build the financial-goal questionnaire
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: todo             # todo | in-progress | blocked
priority: high           # high | medium | low
area: frontend           # backend | frontend | infra | design | pitch | other
created: 2026-11-14
created-by: human        # human | ai
---

# T-013: Build the financial-goal questionnaire

## Goal
A short questionnaire that learns the user's financial goal and situation, so the app can give personalized, educational insights (T-014). This is our financial-literacy angle: the user reflects on their goal before seeing advice.

## Context
- Product idea: [D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md).
- The challenge values plain language, healthier money habits, safe-to-spend / safe-to-save, and young adults: [challenge](../../../references/challenge.md).
- **Data: use the real data in `src/frontend/public/data/s_pankki-demo.db`** (Michal's demo DB, see [D-0007](../../../decisions/D-0007-browser-sqlite.md)). Read it only through `src/frontend/src/data/database.ts` (`loadDatabase`, `listCustomers`, `getMonthlyFlow`, `getSpendingByCategory`, `getCustomerDashboard`, …); schema and API in `src/frontend/DATA.md`. No mock or hard-coded numbers.
- Use the selected customer's data where it helps: e.g. show their real monthly income and spending (from `getMonthlyFlow`) as a reference when they set a target amount, and suggest the categories they spend most on (`getSpendingByCategory`) for "which spending do you want to control".
- The demo DB is read-only in the browser, so answers are stored in `localStorage`, keyed by `customer_id`.

## Acceptance criteria
- [ ] A step-by-step questionnaire (one question per screen, progress indicator, back button), 5–8 questions, finishable in under a minute.
- [ ] Covers at least: the main goal (e.g. emergency buffer, saving for a home, travel, paying off debt, understanding my spending, starting to invest), a target amount and date where it applies, how predictable income is, which spending the user wants to control, and how confident they feel about money (self-assessed literacy).
- [ ] Each question has a one-line plain-language explanation of why it is asked.
- [ ] Answers are saved in `localStorage` per customer (wrapped in try/catch) and can be edited or reset later.
- [ ] At least the target-amount and spending-control questions show the customer's real numbers from `s_pankki-demo.db`.
- [ ] It can be skipped; the dashboard still works without answers.
- [ ] The answers have a TypeScript type that T-014 uses.
- [ ] Mobile layout at 375–430 px, app look, `npm run build` passes.

## Out of scope
- Generating insights (T-014). A separate server or account sync.

## Open questions
- Where the questionnaire starts: the first time the dashboard opens, or from a "Set your goal" card?
- Final question list: draft it in this task and review it with the team before building.

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
