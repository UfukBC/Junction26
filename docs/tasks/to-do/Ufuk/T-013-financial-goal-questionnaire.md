---
id: T-013
title: Build the financial-goal questionnaire
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: in-progress      # todo | in-progress | blocked
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
- [x] A step-by-step questionnaire (one question per screen, progress indicator, back button), 4–8 questions, finishable in under a minute.
- [x] Covers at least: the main goal (e.g. emergency buffer, saving for a home, travel, paying off debt, understanding my spending, starting to invest), a target amount and date where it applies, how predictable income is, and which spending the user wants to control.
- [x] Each question has a one-line plain-language explanation of why it is asked.
- [x] Answers are saved in `localStorage` per customer (wrapped in try/catch) and can be edited or reset later.
- [x] At least the target-amount and spending-control questions show the customer's real numbers from `s_pankki-demo.db`.
- [x] It can be skipped; the dashboard still works without answers.
- [x] The answers have a TypeScript type that T-014 uses.
- [x] Mobile layout at 375–430 px, app look, `npm run build` passes.

## Out of scope
- Generating insights (T-014). A separate server or account sync.

## Open questions
- Where the questionnaire starts: the first time the dashboard opens, or from a "Set your goal" card?
  - Final: the card sits on the Home screen in place of the bank-messages card (team feedback: it should be more visible). It does not auto-open; the card opens the flow and shows the saved goal with Edit / Reset. The selected demo customer and the answers are shared between Home and Bank (state in `App.tsx`), so both always show the same customer's goal.
- Final question list: draft it in this task and review it with the team before building.
  - Built as 4 questions (+ review): goal → target amount and month (skipped for "understand my spending") → income predictability → spending to control (real categories, multi-select) → review. The confidence question was dropped by team decision to keep the flow short.

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
- 2026-11-14: started. Plan: answers type + localStorage helpers in `src/frontend/src/data/questionnaire.ts`, a one-question-per-screen flow in `src/frontend/src/screens/QuestionnaireScreen.tsx`, and a "Set your goal" card on the Bank screen that opens it. Real monthly income/leftover on the target step, real top categories on the control step.
- 2026-11-14: done, all criteria met.
  - `src/frontend/src/data/questionnaire.ts`: `QuestionnaireAnswers` (+ `FinancialGoal`, `IncomePredictability`), option lists and label helpers. Answers live in `localStorage` under `s-pankki.questionnaire.v2.<customer_id>`; `loadAnswers` validates the parsed JSON and all reads/writes are in try/catch (`saveAnswers` returns false when storage is unavailable).
  - `src/frontend/src/screens/QuestionnaireScreen.tsx`: 4-step flow + review, progress bar, back/close/skip. Target step shows real average income and average leftover over the last 12 months (`getMonthlyFlow`), and the example amount/horizon follow the goal (home 25 000 € / 5 years, travel 2 000 € / 1 year, debt 5 000 € / 2 years, invest 5 000 € / 3 years, emergency buffer = 3× the customer's real average monthly spending / 1 year); the control step shows every real spending category with its monthly average (`getSpendingByCategory`). "Understand my spending" skips the target step.
  - `src/frontend/src/screens/DataScreen.tsx`: `GoalCard` above the dashboard content ("Set my goal" when empty; goal summary with Edit / Reset when answered), keyed by the selected customer. `styles.css`: goal-card and questionnaire styles.
  - `npm run build` passes. Not browser-tested end-to-end (agent-browser is not installed); verified the dev server serves the modules.
- 2026-11-14: the spending-control question is now multi-select (per team feedback): `controlCategories: string[]` in the answers type, storage key bumped to `s-pankki.questionnaire.v2.<customer_id>`. "Not sure yet" clears the selection. Build passes.
- 2026-11-14: removed the confidence question (team decision), including `confidence`/`MoneyConfidence` from the answers type, its step, review row and styles. Flow is now 4 questions + review; the coverage criterion no longer asks for self-assessed literacy.
- 2026-11-14: moved the goal card to the Home screen (replaces the bank-messages card; `MessagesCard` and the `unreadMessages` mock field removed). `App.tsx` now owns the selected customer and answers, shared by Home and Bank; `GoalCard` moved to `components/GoalCard.tsx`. Goal-specific example amount and default date on the target step; all spending categories shown in the control step.
- 2026-11-14: compacted the goal card to a single row (icon + title + one-line detail + action) so the full home screen fits without scrolling on a phone-height frame; trimmed the tinted area, quick actions, account rows and the home spending card spacing. `npm run build` passes.
- 2026-11-14: last question is "Do you want to create a savings account for this goal?". Yes stores `createSavingsAccount`. Older saves without that field still load as "no account". The monthly AI move is hardcoded as a popup, not a live model: `monthlySaveCheckIsDue()` is always true so the demo can show it on any day (the real rule is the 1st). The popup adds up the latest month's income and expenses (`getMonthlyFlow`). The offered amount is not the whole remainder. `realisticMonthlySave` is the fallback (goal pace capped at half of what remained). When Ollama is running, `POST /api/savings-check` asks local `qwen3.5:9b` and clamps its `amountEur` to that same safe cap. Save adds that suggested amount to the savings balance in localStorage and subtracts the same amount from the S-Bank account row. "Not this month" records a skip and leaves the S-Bank balance unchanged. One answer per analysed month. Reset clears the goal and those answers. The demo DB stays read-only.
