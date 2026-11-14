# Handoff — 2026-11-14

Work sits on `main` at `0cf77ea` (Home donut card + extended view). Everything below that commit is **uncommitted**. Do not commit `src/frontend/.env`.

Do **not** `git stash pop` the stash named `ai and savings before design pull`. That stash is the pre-donut copy. The savings and AI behaviour was already put back onto the donut design. Popping it will fight `HomeScreen.tsx`, `styles.css`, and the deleted `MonthPie.tsx`.

## What the demo does now

Home is the donut from `0cf77ea`: month arrows in the top bar, donut card, extended view (Month | Everyday), goal card, time-habit banner, quick actions, accounts. The **Analyse spending** link was removed. Tap the ring or a row to open the detail view.

### Summary (not a recommendation)

The card in the extended view has a **summary** and a **recommendation**.

- **Month** — income, fixed bills as a share of income, everyday spending as a share, what was left or how much the month was short, and the largest everyday category.
- **Everyday** — how that basket splits across categories, then the single largest payment (date, what it was, amount).
- **A single category, Income, Fixed, or Left** — no analysis. Tapping one only highlights the slice. Tapping **Everyday** switches to the Everyday view.

Aino (`src/frontend/src/data/advisor.ts`) is the advisor name on the card. The summary text is sent to the model; if the call fails, the same facts stay as the local summary (`useAdvice.ts`).

### Savings

Last questionnaire question: create a savings account for this goal. Yes stores `createSavingsAccount` on the answers in `localStorage` (`s-pankki.questionnaire.v2.<customer>`). Older saves without that field still load as “no account”.

On the 1st of the month the app asks before moving money. `monthlySaveCheckIsDue()` is **hardcoded `true`** so the popup shows on any day until that month is answered. The amount is **not** everything left:

- goal pace = (target − already saved) / months until the target month
- safe cap = half of what remained (income − expenses), rounded down
- offer = the pace when it fits, otherwise the cap

The model writes the reason. The server still clamps `amountEur` to `0…safeCap`. **Save it** adds the amount to the goal account and subtracts it from the S-Bank row (`acc-1`). **Not this month** records a skip. **Reset** on the goal card clears the goal and the sweeps. The demo DB is never written.

S-Etukortti Visa has **no balance**. It is a debit card on the S-Bank account (`Debit · S-Bank account`).

## Model

Ollama is **off**. Do not start it.

Calls go to Nemotron 3.5 Super VL:

- Base URL: `https://containers.datacrunch.io/nemotron-3-5-super-vl-b300/v1`
- Model id: `nemotron-3.5-super-vl`
- Env: `VERDA_INFERENCE_KEY` in `src/frontend/.env` (gitignored by `.gitignore` line `.env`)

The browser never sees the key. Vite middleware in `src/frontend/vite.config.ts` adds it:

- `POST /api/segment-advice` — month and Everyday summary
- `POST /api/savings-check` — monthly save reason and amount

The model spends tokens on a `reasoning` field and then puts JSON in `content`. `verdaChat` uses `content` when it is present. `max_tokens` is 1200 so `content` is not left empty. A `vite.config.ts` change needs a **restart** of `npm run dev`; it does not hot-reload.

## Run

```powershell
cd C:\Users\ckaql\junction\src\frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173/. Default customer is `CUST04457`. Another demo customer: `?customer=CUST03172` (the time-habit one). Data ends **2026-09-30**.

## Files that hold this behaviour

| File | What |
|---|---|
| `src/frontend/src/screens/HomeScreen.tsx` | Donut home, savings account row, balance reduction, monthly popup |
| `src/frontend/src/screens/QuestionnaireScreen.tsx` | Last question creates the savings account |
| `src/frontend/src/data/questionnaire.ts` | Answers, pace/cap math, sweep storage |
| `src/frontend/src/data/savingsCheck.ts` | Client for `/api/savings-check` |
| `src/frontend/src/components/MonthlySavePrompt.tsx` | 1st-of-month dialog |
| `src/frontend/src/components/spending/SpendingDetail.tsx` | Month / Everyday summary card |
| `src/frontend/src/data/useAdvice.ts` | Builds the month and Everyday facts, then asks the model for the summary |
| `src/frontend/src/data/advisor.ts` | Aino’s voice, MCC place names |
| `src/frontend/vite.config.ts` | Both API routes and the Nemotron call |
| `src/frontend/.env` | `VERDA_INFERENCE_KEY` only. Not in git |

## Do not change by accident

- Savings amount rule (pace capped at half of what remained) and the S-Bank balance deduction.
- Summary only, for **month** and **Everyday** only. No per-category analysis and no recommendation line.
- The key stays in `.env`. Never paste it into a source file or a commit.
