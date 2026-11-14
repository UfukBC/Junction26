# Decisions index

Architectural decisions the team made, newest at the bottom. Open only what your task needs.
**Do not edit directly.** Propose new decisions in `docs/inbox.md`. `/drain` adds them here.

| ID | Title | Status | Date |
|---|---|---|---|
| [D-0001](D-0001-docs-and-task-workflow.md) | Docs and task workflow (inbox → review → drain) | accepted | 2026-11-13 |
| [D-0002](D-0002-sp-pankki-challenge.md) | Build for the S-Pankki "Personal Economic Trainer" challenge | accepted | 2026-11-14 |
| [D-0003](D-0003-dataset-location.md) | The challenge dataset lives in `data/raw/`, outside git | superseded by D-0007 | 2026-11-14 |
| [D-0004](D-0004-mobile-web-app.md) | Deliver a mobile-first web app that can be embedded in S-mobiili | accepted | 2026-11-14 |
| [D-0005](D-0005-frontend-stack.md) | Frontend: React + TypeScript + Vite, plain CSS, an S-mobiili-style shell | accepted (data/backend part superseded by D-0007) | 2026-11-14 |
| [D-0006](D-0006-product-dashboard-questionnaire.md) | Product: a spending dashboard with goal-based personalized insights, no chatbot, no backend for now | accepted (yearly view superseded by D-0009) | 2026-11-14 |
| [D-0007](D-0007-browser-sqlite.md) | No backend: ship a slim SQLite database and query it in the browser with sql.js | accepted | 2026-11-14 |
| [D-0008](D-0008-three-basket-mapping.md) | First mapping of transactions to the three baskets | accepted | 2026-11-14 |
| [D-0009](D-0009-home-month-pie.md) | Home shows one month at a time as a pie (Chamb's version); no annual view | accepted (pie and layout superseded by D-0012) | 2026-11-14 |
| [D-0010](D-0010-personal-time-habit-warning.md) | Spending-time warning: personal baseline only, rule-based text, shown on Home only when a habit exists | accepted | 2026-11-14 |
| [D-0011](D-0011-no-other-customers-data.md) | Features use only the user's own data; comparisons use only public Finnish consumption statistics | accepted | 2026-11-14 |
| [D-0012](D-0012-home-donut-and-extended-view.md) | Home spending card and extended view as one donut-ring design with an AI overview | accepted | 2026-11-14 |
