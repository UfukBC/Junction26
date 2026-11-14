# D-0007: No backend: ship a slim SQLite database and query it in the browser with sql.js

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Michal (data-layer commit `6655cbf`); Ufuk approved superseding D-0003
- **Source:** inbox entry I-20261114-browser-sqlite / task none

## Context
The app needs per-customer transaction, spending and mortgage data. The full dataset is 346 MB CSV / ~585 MB SQLite (3.6 M transactions) — too large to bundle or load on a phone. The team decided against Python and any backend service.

## Decision
- A Node script (`src/frontend/scripts/build-demo-db.mjs`, using sql.js) builds a **subset** database for a handful of demo customers from `data/raw/`, written to `src/frontend/public/data/s_pankki-demo.db` (~464 KB, committed).
- The app loads it at runtime with sql.js (SQLite compiled to WASM; `public/sql-wasm.wasm`) and queries it through the typed API in `src/frontend/src/data/database.ts`.
- `DataScreen` (Bank tab) exposes a customer switcher over the bundled demo customers.
- The full dataset stays local in `data/raw/` (gitignored). The subset is reproducible with `npm run build:data`.

## Alternatives considered
- **Python or Node HTTP API + SQLite:** adds a service to run/deploy; rejected because the team wants no backend for the hackathon.
- **JSON data modules:** smaller to implement but loses SQL and requires hand-written aggregations; rejected in favour of real SQLite queries.
- **Full 585 MB DB in the browser:** sql.js loads the whole file into memory; rejected as unusable on mobile.

## Consequences
- Everything runs client-side; the demo works from a static host.
- Only a subset ships. Add customers with `node scripts/build-demo-db.mjs --customers …` and rebuild.
- `.gitignore` had a bare `data/` rule that also ignored `src/frontend/src/data/` (which is why `src/data/mock.ts` was missing from the repo). It is now anchored to `/data/` so frontend data modules can be committed.
- Supersedes D-0003 on where data lives: raw challenge files stay in `data/raw/` (gitignored, never committed), while the small, reproducible demo database is committed in `src/frontend/public/data/`.
