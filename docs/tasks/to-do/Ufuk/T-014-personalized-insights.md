---
id: T-014
title: Show personalized insights from the user's goal and spending
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: todo             # todo | in-progress | blocked
priority: medium         # high | medium | low
area: frontend           # backend | frontend | infra | design | pitch | other
created: 2026-11-14
created-by: human        # human | ai
---

# T-014: Show personalized insights from the user's goal and spending

## Goal
Turn the questionnaire answers (T-013) and the customer's real spending data from `s_pankki-demo.db` into a few clear, personal insights that teach something and point to one next step. No chatbot.

## Context
- Product idea: [D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md).
- **Data: use the real data in `src/frontend/public/data/s_pankki-demo.db`** (Michal's demo DB, see [D-0007](../../../decisions/D-0007-browser-sqlite.md)). Read it only through `src/frontend/src/data/database.ts` (`loadDatabase`, `listCustomers`, `getMonthlyFlow`, `getSpendingByCategory`, `getCustomerDashboard`, …); schema and API in `src/frontend/DATA.md`. No mock or hard-coded numbers.
- Needs T-013 (answers); T-010 adds any missing query functions. Shown on the dashboard (T-011, T-012).
- Challenge themes: three baskets, safe-to-spend / safe-to-save, "what if" (e.g. cut dining out by 20%), plain language: [challenge](../../../references/challenge.md).
- Insights are computed in the frontend from the demo DB. There is no server, so no live LLM calls from the browser (an API key there would leak).

## Acceptance criteria
- [ ] 3–5 insight cards on the dashboard, each with: a headline in plain language, the number behind it from the user's data, why it matters (one sentence), and one concrete next step.
- [ ] At least one insight ties directly to the user's goal (e.g. "To reach 5 000 € by June, set aside 420 €/month; your average leftover is 260 €").
- [ ] At least one "what if" insight (e.g. "Cutting restaurants by 20% saves 61 €/month").
- [ ] Every number in an insight is computed from the customer's data in `s_pankki-demo.db`.
- [ ] Insights change when the answers or the selected customer change; with no answers, generic data-based insights are shown.
- [ ] The rules live in one module of pure, unit-testable functions, and each rule documents its formula.
- [ ] `npm run build` passes.

## Out of scope
- A chatbot or free-text Q&A. A separate server or live LLM service.
- Benchmarks against Statistics Finland (possible follow-up).

## Open questions
- Use the three baskets in insights once the mapping is decided?
- Precompute some insight text with an LLM offline (stored in the demo DB by the build script) for originality, while keeping the app chat-free?

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
