---
id: T-015
title: Add AI integration endpoints for dashboard overviews and insight text
owner: Ufuk              # Ufuk | Michal | Chamb | unassigned
status: todo             # todo | in-progress | blocked
priority: high           # high | medium | low
area: backend            # backend | frontend | infra | design | pitch | other
created: 2026-11-14
created-by: human        # human | ai
---

# T-015: Add AI integration endpoints for dashboard overviews and insight text

## Goal
Give the dashboard real AI-written text — a yearly overview, a per-month summary, plain-language category explanations, personalized insight narration, and what-if explanations — through a small local API server that keeps the provider key off the client. Today the app has no server at all ([D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md) says "no backend for now"); this task deliberately reverses that part of D-0006 for AI calls, so the AI integration is real instead of precomputed. Judging weight: "originality of AI" is 20%.

## Context
- Product idea: [D-0006](../../../decisions/D-0006-product-dashboard-questionnaire.md); challenge values plain language, safe-to-spend/save, what-if: [challenge](../../../references/challenge.md).
- **Data:** the client already computes everything from `src/frontend/public/data/s_pankki-demo.db` via `src/frontend/src/data/database.ts` (`getYearSpending`, `getSpendingByCategory`, `getMonthlyFlow`, `getCustomerDashboard`; see [src/frontend/DATA.md](../../../../src/frontend/DATA.md)). The AI layer **receives aggregates only** (year totals, monthly rows, category shares, questionnaire answers) — never raw transactions and never the DB file.
- Questionnaire answers (T-013) and the dashboard views (T-011, T-012) are the consumers.
- **Relation to T-014:** independent tasks. T-014 keeps the deterministic, rule-based insight cards; this task owns the server/AI plumbing and the generated narration. Do not duplicate T-014's rules here — the AI endpoint narrates the insight objects T-014 produces (or the same aggregates if T-014 is not done yet).
- `src/backend/` exists but is empty (only `.gitkeep`). There is no root `package.json`; the server gets its own `package.json` inside `src/backend/`.
- Provider is **flexible**: one adapter interface, selected by env (`AI_PROVIDER=openai|anthropic|mock`, `AI_MODEL`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`). No provider SDK required — Node 18+ global `fetch` is enough. A `mock` provider returns deterministic template text so the demo works with no key and no network.
- Secrets: `.env` only, never committed; `.env.example` documents the variable names. The key must never appear in `src/frontend/` or in the built bundle.
- Because this changes D-0006, the implementation must also append an inbox entry proposing the "no backend" decision be amended (see [docs/templates/inbox-entry.md](../../../templates/inbox-entry.md)); do not edit `docs/decisions/` directly.

## Acceptance criteria
- [ ] `src/backend/` has a runnable server (`npm install && npm run dev`, default port e.g. 8787) with its own `package.json`, its own `tsconfig`/type-check or plain `.mjs` (state the choice in Progress).
- [ ] Provider-agnostic adapter: `openai`, `anthropic`, and `mock` implementations behind one interface (`generate({ system, prompt, maxTokens }) → string`). Switching provider/model is env-only, no code change.
- [ ] Endpoints, JSON in / JSON out, each documented with a `curl` example in `src/backend/README.md`:
  - `POST /api/ai/overview` — year + totals + monthly rows + goal → 3–5 sentence overview.
  - `POST /api/ai/month-summary` — one month's totals, top categories, vs. the year's monthly average → 2–3 sentences.
  - `POST /api/ai/category` — category name, amount, share, benchmark → one plain-language sentence.
  - `POST /api/ai/insight` — insight object(s) from T-014 and/or aggregates + questionnaire answers → 1–2 sentence narration, no invented numbers.
  - `POST /api/ai/what-if` — scenario (e.g. "cut restaurants 20%"), baseline and result → 2 sentences, states the saving.
- [ ] Every endpoint validates its body (rejects missing/oversized fields with 400 and a JSON error), caps prompt input size, applies a request timeout, and returns a structured error instead of throwing.
- [ ] The system prompt forbids inventing figures, requires plain language, and is shared in one module (not copy-pasted per endpoint).
- [ ] Responses are cached in memory by a hash of the request (same input → same text, no repeat provider calls) with a documented way to clear the cache; identical demo clicks stay deterministic.
- [ ] Frontend client `src/frontend/src/data/ai.ts` exposes typed functions for each endpoint; Vite proxy sends `/api` to the server in `vite.config.ts`.
- [ ] The dashboard text components render AI text when the server is reachable and fall back to static/last-good copy when it is not (server down, no key, timeout) — the demo must never show a blank or an error card.
- [ ] No provider key or secret is present in the frontend source or the built bundle; `.env` is gitignored and `.env.example` is committed with variable names only.
- [ ] `src/backend/README.md` documents env vars, endpoints, and how to run both processes; an inbox entry proposes the D-0006 amendment with evidence.
- [ ] `cd src/frontend && npm run build` passes, and the server's type-check/lint (if any) passes.

## Out of scope
- A chatbot or free-text Q&A over the data (rejected in D-0006).
- Replacing T-014's rule-based insight logic; this task narrates, it does not compute insights.
- Auth, accounts, rate limiting per user, deployment/hosting, streaming responses.
- Persisting generated text in the demo DB or shipping AI text for every customer at build time.
- Changing the demo DB or the dataset.

## Open questions
- Output language: Finnish, English, or an `Accept-Language`/`language` field per request? The challenge and S-mobiili are Finnish-facing, but the team demos in English.
- Default provider/model for the demo (cheap + fast, e.g. a small model), and whether the mock provider is the default so the repo runs offline.
- Server reads the demo DB directly vs. client sends aggregates. Recommendation: client sends aggregates (keeps the server stateless and avoids duplicating the SQL layer).
- Should generated overview text be cached in `localStorage` per customer/year as well, to survive a server restart during the pitch?
- Where the "Regenerate" affordance lives (if any), to avoid nondeterministic text mid-demo.

## Progress
<!-- Whoever works on the task updates this, oldest first. It should be enough for a fresh session to pick up the work. -->
