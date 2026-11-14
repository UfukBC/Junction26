---
id: T-016
title: Warn the user about their own risky spending-time habits
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: in-progress      # todo | in-progress | blocked
priority: medium         # high | medium | low
area: frontend           # backend | frontend | infra | design | pitch | other
created: 2026-11-14
created-by: human        # human | ai
---

# T-016: Warn the user about their own risky spending-time habits

## Goal
Use the purchase timestamps of **one user** to learn when *they* spend, and warn them when *their own* big spending keeps happening at times that suggest impulse or tired spending (e.g. large purchases late in the evening or at night). The AI overview explains the habit in plain language and suggests one change. The warning is purely personal: it is based on that user's own history and is never compared with other customers or population averages.

## Context
- Product idea: [D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md). The warning appears in the Home month view (`src/frontend/src/screens/HomeScreen.tsx`, `src/frontend/src/components/MonthPie.tsx`, where Chamb's trainer notes already appear); agree the exact placement with Chamb, since there is no separate analysis screen, together with T-014's insights; AI wording comes from T-015.
- Data: `s_pankki-demo.db` via `src/frontend/src/data/database.ts` (see [frontend-data](../../../references/frontend-data.md)). `transactions.tx_ts_iso` (`YYYY-MM-DDTHH:MM:SS`) has the purchase time; never sort on the raw `tx_timestamp` text.
- **Personal baseline only.** Every threshold is derived from the same user's data: what counts as a "big" purchase is relative to *their* median purchase, and "unusual timing" means their big purchases are concentrated in a window compared with *their own* purchases overall. No other customer's data and no population statistic is used in the detection, the numbers shown, or the text.
- Purchases in the dataset only happen between 05:00 and 23:59, so "night" means roughly 21:00–05:00 here.
- Heads-up for the demo: whether a given customer shows such a habit depends on their own history; many won't. That is the correct result (no warning), not a bug. To pick demo customers who do show it, check candidates' own histories while *building the demo* (a one-off analysis, like T-010); that selection step is not part of the product logic.

## Acceptance criteria
- [x] A query in `database.ts` (typed, documented in `DATA.md`) that returns one customer's purchases grouped by hour of day and by weekday for a period, using `tx_ts_iso`.
- [x] A pure, unit-testable function that takes one customer's purchases and flags a risky time habit using only that customer's data: "big" = at least ~3× their own median purchase and at least ~100 €; flagged when their big purchases are clearly over-represented in a time window (e.g. 21:00–05:00, or weekends) compared with their own purchases overall, with a minimum count so a one-off doesn't trigger it. Thresholds documented, and a test showing the same purchases give the same result regardless of who else is in the database.
- [x] The finding states what was found using the user's own numbers (e.g. "6 of your 9 purchases over 200 € were after 21:00, 1,840 € in total") and presents the cause (tiredness, impulse) as a possibility, never as fact.
- [x] The warning appears in the Home month view (see Context), for the shown month or the last 3 months, with a plain-language explanation and one suggested habit (e.g. "wait 24 hours before large evening purchases"). With no habit found, nothing is shown (no empty warning).
- [x] At least one demo customer shows the warning and at least one clearly does not (selection and reasons noted in `DATA.md`; rebuild with `npm run build:data -- --customers …`). If no real customer shows a convincing habit, tell the team rather than faking data.
- [x] `npm run build` passes and the screen works at 375–430 px.

## Out of scope
- Comparing the user with other customers, age groups or national averages (benchmarks elsewhere in the app are separate and are not used here).
- Writing the AI text with an LLM (T-015); this task produces the structured finding (habit, window, numbers) that T-015 turns into text, plus a rule-based fallback sentence.
- Location, merchant or device signals, and blocking or delaying payments.

## Open questions
- Which windows count as risky for one user: late night only, or also weekends, paydays, or specific weekdays? Start with night and weekend.
- Should the warning also use *frequency* ("you buy something after 22:00 on 5 days a week") and not only amounts?
- How much history is enough for a personal baseline (e.g. at least 3 months and 30 purchases)? Below that, show nothing.

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
- 2026-11-14: started.
- 2026-11-14: done, all criteria met.
  - `database.ts`: `getPurchases` and `getSpendingByHourAndWeekday` (checked on the real DB: the cells add up to exactly the customer's purchases). `src/data/timeHabits.ts`: pure `detectTimeHabits` + `describeHabit`, 9 Vitest tests (`npm test`, vitest added as a dev dependency), including one showing the result does not depend on any other customer's data.
  - UI: `components/TimeHabitCard.tsx` on Home under the pie, 3 months ending at the month on screen, nothing shown when there is no habit. `?customer=` URL parameter added to `HomeScreen` to view other demo customers.
  - Demo: none of the 8 existing demo customers has a habit (expected). Added CUST03172 (late-evening big spender: 6 of 14 big purchases, 6,741 €, after 21:00; only 9% of their purchases are that late) by checking candidates' own histories when building the demo. Demo DB is now 9 customers.
  - Left open: risky windows beyond night/weekend, frequency-based wording, stricter evidence thresholds.
  - Inbox: `I-20261114-personal-time-habit-warning`; the demo-DB entry now says 9 customers.
