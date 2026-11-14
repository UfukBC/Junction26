# D-0010: Spending-time warning: personal baseline only, rule-based text, shown on Home only when a habit exists

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Ufuk (approved an AI design choice from T-016)
- **Source:** inbox entry I-20261114-personal-time-habit-warning / task T-016

## Context
The team wants a warning when a user keeps making big purchases at times that suggest tired or impulse spending (idea: timestamps), based on the user's own habits and not on other customers.

## Decision
- The detection uses only one customer's own purchases. "Big" = at least 3× their own median purchase and at least 100 €. A habit = at least 3 big purchases (and at least 40% of their big purchases) inside a window (late evening from 21:00, or weekends) AND that window's share of big purchases is at least 2× its share of all their purchases, with at least 30 purchases and 5 big ones in the 3 months considered. No population statistic or other customer enters the logic.
- The warning appears on Home under the month pie, for the 3 months ending at the month on screen, and not at all when there is no habit. It shows the customer's own numbers and their three largest big purchases in the window.
- The text is rule-based (`describeHabit`) and presents tiredness or impulse only as a possibility. The structured finding is what an AI text layer (T-015) can start from.
- `CUST03172` was added to the demo DB as the example. The other 8 demo customers show no habit, which is the expected result.
- `HomeScreen` reads an optional `?customer=` URL parameter (default `CUST04457`) so other demo customers can be viewed.

## Alternatives considered
- **Population rule ("evening purchases are risky"):** rejected by Ufuk; features must not use other customers' data (see the data-source rule decision).
- **LLM decides whether there is a habit:** not reproducible and not testable; the LLM can explain a finding instead.

## Consequences
- Weekend and late-evening habits are different findings; which one a demo customer shows depends only on their own history, so demo customers are chosen deliberately.
- With only 3 big purchases needed in a window, some flags rest on little evidence; raise `minBigInWindow` in `DEFAULT_HABIT_OPTIONS` for stricter warnings.
- The `vitest` dev dependency was added for the unit tests (`npm test`).
