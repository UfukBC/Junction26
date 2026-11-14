# Backend: local AI narration server

A small, dependency-free Node server that turns dashboard **aggregates** into plain-language text.
It exists so the app can have real AI narration without shipping the provider key to the browser.

- No npm dependencies. Node 18.17+ (`fetch`, `AbortSignal.timeout`).
- JSON in, JSON out. One provider interface: `openai`, `anthropic`, `xai`, or `mock`.
- The server never reads the demo DB. The client sends totals, monthly rows, category shares and
  questionnaire answers — never raw transactions.
- In-memory cache: the same request returns the same text and skips the provider call.

## Run

```bash
cd src/backend
npm install        # nothing to install, but keeps the workflow uniform
npm run dev        # http://127.0.0.1:8787 (node --watch)
```

In a second terminal:

```bash
cd src/frontend
npm run dev        # http://localhost:5173, /api is proxied to the backend
```

The Vite dev server and `vite preview` proxy `/api` to `http://127.0.0.1:8787`
(`AI_SERVER_URL` overrides the target). With the backend down, the proxy returns an error and the
frontend keeps its static copy — nothing goes blank.

Without any key the server runs with `AI_PROVIDER=mock`: deterministic template text built from the
same aggregates, so the demo works offline. Set a key for real narration.

## Environment

Copy `src/backend/.env.example` to `src/backend/.env` (gitignored) or use real environment variables.
A `.env` at the repo root is read as well; existing environment variables win.

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | auto | `mock`, `openai`, `anthropic` or `xai`. Unset: the first provider whose key is set, else `mock`. |
| `AI_MODEL` | per provider | `gpt-4o-mini`, `claude-3-5-haiku-latest`, `grok-4.7` (or `mock`). |
| `OPENAI_API_KEY` | — | Needed when `AI_PROVIDER=openai`. |
| `ANTHROPIC_API_KEY` | — | Needed when `AI_PROVIDER=anthropic`. |
| `XAI_API_KEY` | — | Needed when `AI_PROVIDER=xai`. |
| `PORT` | `8787` | Listen port (binds to `127.0.0.1`). |
| `AI_TIMEOUT_MS` | `25000` | Provider request timeout; a timeout answers `504`. |
| `AI_MAX_TOKENS` | `400` | Response token cap. |

`AI_PROVIDER` set to a provider without its key is a startup error, not a silent fallback.

The key lives only here. It is not in `src/frontend/`, not in the built bundle, and `.env` is
gitignored at every level.

## Endpoints

| Method | Path | Body → response |
|---|---|---|
| `GET` | `/api/health` | → `{ ok, provider, model, cacheEntries, endpoints }` |
| `POST` | `/api/ai/overview` | year + totals + monthly rows + goal → `{ text }` (3-5 sentences) |
| `POST` | `/api/ai/month-summary` | one month's totals, top categories, year's monthly average → `{ text }` (2-3 sentences) |
| `POST` | `/api/ai/category` | category, amount, share, benchmark share → `{ text }` (one sentence) |
| `POST` | `/api/ai/insight` | insight objects and/or aggregates + questionnaire answers → `{ text }` (1-2 sentences) |
| `POST` | `/api/ai/what-if` | scenario, baseline and result → `{ text }` (2 sentences, states the saving) |
| `POST` | `/api/segment-advice` | `{ month, segment, brief }` → `{ summary, recommendation }` (home pie trainer copy) |
| `POST` | `/api/cache/clear` | → `{ cleared }` |

Every AI body accepts `language: "en" | "fi"` (default `en`) and validates its fields: missing,
mistyped or oversized input is a `400` with a JSON error; the body is capped at 32 KB.

### curl examples

```bash
curl -s http://127.0.0.1:8787/api/health

curl -s http://127.0.0.1:8787/api/ai/overview \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "en",
    "year": 2025,
    "totals": { "spendingEur": 24000, "incomeEur": 30000, "monthsWithData": 12, "averageMonthlySpendingEur": 2000 },
    "months": [
      { "month": "2025-01", "spendingEur": 1800, "incomeEur": 2500 },
      { "month": "2025-02", "spendingEur": null, "incomeEur": null }
    ],
    "goal": { "label": "Emergency buffer", "targetAmountEur": 6000, "targetDate": "2027-06" }
  }'

curl -s http://127.0.0.1:8787/api/ai/month-summary \
  -H 'Content-Type: application/json' \
  -d '{
    "month": "2026-09",
    "spendingEur": 2100,
    "incomeEur": 2500,
    "topCategories": [
      { "name": "Groceries", "amountEur": 600, "sharePct": 28.6 },
      { "name": "Restaurants", "amountEur": 180, "sharePct": 8.6 }
    ],
    "yearAverageMonthlySpendingEur": 1900
  }'

curl -s http://127.0.0.1:8787/api/ai/category \
  -H 'Content-Type: application/json' \
  -d '{ "category": "Restaurants", "amountEur": 180, "sharePct": 12.5, "benchmarkSharePct": 7.8 }'

curl -s http://127.0.0.1:8787/api/ai/insight \
  -H 'Content-Type: application/json' \
  -d '{
    "insights": [{ "title": "Restaurants are 12.5 % of your spending", "amountEur": 180 }],
    "questionnaire": { "goal": "understand_spending" }
  }'

curl -s http://127.0.0.1:8787/api/ai/what-if \
  -H 'Content-Type: application/json' \
  -d '{
    "scenario": "you cut restaurants by 20 %",
    "baseline": { "spendingEur": 2100 },
    "result": { "spendingEur": 2064 }
  }'

curl -s http://127.0.0.1:8787/api/cache/clear -X POST
```

## Behaviour and limits

- **House rules** live in one module (`src/prompts.mjs`): only the figures in the request, plain
  language, no invented numbers, no cutting fixed costs or necessary health care, sentence count.
- **Mock provider** returns deterministic text built from the validated input, in the requested
  language — the same helper text is used in the tests.
- **Cache**: keyed by SHA-256 of provider + model + system prompt + prompt + max tokens. Identical
  demo clicks do not call the provider twice. Clear with `POST /api/cache/clear` or by restarting.
- **Errors** are always JSON: `{ "error": { "code", "message" } }` with
  `400 bad_request`, `413 payload_too_large`, `404 not_found`, `405 method_not_allowed`,
  `502 provider_error`, `504 timeout`, `500 internal_error`.
- Provider replies are capped by `AI_MAX_TOKENS`; failures never crash the process.

## Frontend client

`src/frontend/src/data/ai.ts` exposes `fetchAiOverview`, `fetchAiMonthSummary`, `fetchAiCategory`,
`fetchAiInsight`, `fetchAiWhatIf`, `fetchAiHealth`, `clearAiCache`. Each narration call resolves to
`null` on failure, so components can fall back to their static copy.

## Tests

```bash
cd src/backend
npm run check      # node --check on every source file
npm test           # node:test, mock provider, real HTTP on an ephemeral port
```

## Moved from the Vite dev server

The `/api/segment-advice` route used to be a Vite plugin reading `XAI_API_KEY` from
`src/frontend/.env`. It now lives here, unchanged in contract, and `vite.config.ts` only proxies
`/api`. Move that key to `src/backend/.env` as `XAI_API_KEY` (and delete the old frontend copy).
