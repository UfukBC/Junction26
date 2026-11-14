# D-0009: Home shows one month at a time as a pie (Chamb's version); no annual view

- **Date:** 2026-11-14
- **Status:** accepted; its pie, layout and "no separate analysis screen" points are superseded by D-0012
- **Deciders:** Ufuk (stated in chat)
- **Source:** inbox entry I-20261114-home-current-month-pie / task T-011, T-012

## Context
D-0006 planned a yearly, month-by-month dashboard. After seeing the app, Ufuk asked not to show annual expenses but one month, with a pie chart, and arrows to switch months. Two pie versions existed (Ufuk's with a separate analysis screen, Chamb's `MonthPie` on Home); Ufuk chose Chamb's because it looks better, and Ufuk's was removed.

## Decision
- The Home screen shows one month (1st to last day) at a time, with ‹ › arrows over the months that have data. It opens on the latest month with data (September 2026, since the data ends 2026-09-30).
- The month is shown as a pie of Income, Fixed (housing and utilities), Everyday (tap for its categories) and Left, with the trainer notes of `MonthPie`.
- There is no annual view and no separate analysis screen for now.

## Alternatives considered
- **Yearly month-by-month chart (D-0006, T-011):** rejected by Ufuk after seeing the app.
- **Ufuk's version** (compact pie of spending by category, a bigger analysis screen with every category, change vs the previous month and an AI overview area): removed in favour of Chamb's pie. It is in git history (commit `b446b1b`).

## Consequences
- T-011 (yearly dashboard) is on hold; the year helpers from T-010 (`getYearSpending`, `listAvailableYears`) stay available but unused by the UI.
- The S-mobiili bonus card is gone from the home screen.
- Where T-014 insights and the T-016 time-habit warning appear must be agreed with Chamb, since there is no analysis screen any more.
