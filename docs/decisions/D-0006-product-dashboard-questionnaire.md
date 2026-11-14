# D-0006: Product: a spending dashboard with goal-based personalized insights, no chatbot, no backend for now

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Team (stated by Ufuk)
- **Source:** inbox entry I-20261114-product-dashboard-questionnaire / tasks T-010 to T-014

## Context
D-0002 commits us to S-Pankki's "Personal Economic Trainer" challenge, and the brief suggests chatting with your own data. The team chose a different shape for the product.

## Decision
- A dashboard screen in the S-mobiili-style app: the user's spending for a year, month by month, plus a pie chart that groups expenses by category.
- A short questionnaire learns the user's financial goal, to give personalized insights that build financial literacy.
- **No chatbot.**
- **No backend for now.** The demo uses the slim SQLite database queried in the browser ([D-0007](D-0007-browser-sqlite.md), `src/frontend/DATA.md`).

## Alternatives considered
- **Chat with your own data (the brief's suggestion):** not chosen. The team's reason is not recorded yet.

## Consequences
- "Originality of AI integration" (20% of judging) has to come from the personalized insights rather than from a conversation. How the insights are generated (rules, or text precomputed offline) is still open (T-014).
- Without a backend, nothing personal leaves the device: questionnaire answers live in browser storage.
- The demo runs on a few prepared demo customers, not on all 5,100.
