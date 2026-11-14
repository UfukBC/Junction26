# Junction26 — Agent Guide

Hackathon project for Junction 2026. Team: **Ufuk, Michal, Chamb**.
Every AI agent starts here. Read this file in full. Read everything else only when the task needs it.

## Project

**Challenge:** S-Pankki "Personal Economic Trainer" ([D-0002](docs/decisions/D-0002-sp-pankki-challenge.md)): an AI experience that lets people chat with their own banking data, on S-Pankki's synthetic dataset (5,100 customers, 3.6 M transactions, Oct 2024 – Sep 2026). S-Pankki values the three-basket pedagogy (mandatory regular / mandatory irregular / everyday leak), MyData-style free exploration, plain-language explanations, what-if simulation, and safe-to-spend / safe-to-save guidance, on mobile. Judged 20% each on financial literacy, originality of AI, mobile UX clarity, feasibility, and S-mobiili fit. Brief: [challenge](docs/references/challenge.md). Data: [dataset](docs/references/dataset.md).

> TODO (team): our concrete idea and the demo we're aiming for.

- Data: download once into `data/raw/` (gitignored, [D-0003](docs/decisions/D-0003-dataset-location.md)); instructions and checksum in the dataset reference. Never commit data or put it in `docs/`.
- Stack: mobile-first web app embeddable in S-mobiili ([D-0004](docs/decisions/D-0004-mobile-web-app.md)); frontend React + TypeScript + Vite ([D-0005](docs/decisions/D-0005-frontend-stack.md)). **No backend**: a slim SQLite DB ships with the frontend and is queried in-browser with sql.js — see [src/frontend/DATA.md](src/frontend/DATA.md).
- Rebuild the demo DB (needs `data/raw/`): `cd src/frontend && npm run build:data`
- Run frontend: `cd src/frontend && npm install && npm run dev` → <http://localhost:5173> (phone-sized; open in a phone or a narrow window). Build/type-check: `npm run build`.

## Repo map

| Path | What's there |
|---|---|
| `src/backend/` | Unused — there is no backend; the data layer lives in the frontend |
| `src/frontend/` | Mobile web app (React + TypeScript + Vite). `src/App.tsx` = S-mobiili-style shell, `src/components/`, mock home data in `src/data/mock.ts`, Bank tab in `src/screens/DataScreen.tsx` |
| `src/frontend/src/data/database.ts` | Typed sql.js query API over the demo DB (the integration surface) |
| `src/frontend/scripts/build-demo-db.mjs` | Builds `src/frontend/public/data/s_pankki-demo.db` from `data/raw/` |
| `src/frontend/DATA.md` | Data pipeline, DB schema, query API, integration notes |
| `data/` | Challenge dataset and derived data. Gitignored, local only |
| `docs/references/` | Human-verified facts the code doesn't show: DB schema, external APIs, env/setup, gotchas |
| `docs/decisions/` | Human-verified architectural decisions (`D-NNNN-*.md`) |
| `docs/tasks/to-do/<Owner>/` | Open tasks per team member. `unassigned/` holds tasks with no owner yet |
| `docs/inbox.md` | Knowledge proposed by AI, waiting for human review |
| `docs/templates/` | Templates for tasks, decisions, references and inbox entries |
| `.claude/skills/` | Workflows: `start-task`, `new-task`, `drain`, `finish-task` |

## Team & ownership

| Member | Owns (areas) | Task folder |
|---|---|---|
| Ufuk | TODO | `docs/tasks/to-do/Ufuk/` |
| Michal | TODO | `docs/tasks/to-do/Michal/` |
| Chamb | TODO | `docs/tasks/to-do/Chamb/` |

Assign a new task to the owner of its area. If the area or the owner is unclear, put it in `unassigned/`.

## Loading context without wasting tokens

1. This file.
2. The task file you are working on.
3. `docs/references/README.md` and `docs/decisions/README.md`. These are indexes with one line per doc. Open only the docs that matter for the task.
4. Then the code, targeted. Don't sweep the repo for something a reference already answers.

References and decisions are verified, so trust them over your own assumptions. If the code contradicts them, the code wins: add an inbox entry that flags the mismatch.
Inbox entries are **unverified**. You may use them, but say so when you rely on one.

## Rules: knowledge (references and decisions)

- **Never edit `docs/references/` or `docs/decisions/` directly.** The one exception is the `drain` skill, which copies entries that humans have approved.
- When you learn something a future agent will need and the code doesn't make obvious, append an entry to `docs/inbox.md` using `docs/templates/inbox-entry.md`. Do this without being asked. Examples: schema details, quirks of an external API, an env or setup trap, a non-obvious coupling between modules, or a decision the team stated in chat.
- Bar for an entry: it saves the next agent more than 5 minutes of reading, or it prevents a mistake. Skip anything a quick read of the code shows, anything that just restates the task, and temporary state.
- **Decision vs reference.** A decision is a choice between alternatives, with the reason ("SQLite, not Postgres, because…"). A reference is a fact ("`users` has columns…", "API X allows 10 req/s").
- Include evidence (`file:line`, a command and its output, a link) so reviewers can check the entry quickly.

## Rules: tasks

- Each task is a file: `docs/tasks/to-do/<Owner>/T-NNN-<slug>.md`, in the format of `docs/templates/task.md`.
- If you find a bug, a missing piece or tech debt **outside the current task's scope**, don't fix it silently and don't grow the task. Create a task with the `new-task` skill (`created-by: ai`), mention it to the user in one line, and carry on with the current task.
- Start working on a task only via `start-task`, or when the user asks you to directly.
- Keep the task's **Progress** section current while you work, so that a fresh session can pick it up.
- Never delete a task file except through `finish-task`.

## Workflow

```
/start-task T-003    AI loads context, marks the task in-progress and works on it
  (while working)    AI adds findings to docs/inbox.md and creates tasks for any bugs it finds
  human review       team checks docs/inbox.md, fixes or deletes wrong entries, ticks [x] Approved
/drain               approved entries move into references/decisions and leave the inbox
/finish-task T-003   final checks, then the task file is deleted
```

If your tool has no skill support, open `.claude/skills/<name>/SKILL.md` and follow it by hand.

## Coding conventions

> TODO (team): fill in as you decide. Agents can propose conventions through the inbox.

- Hackathon pace: a working demo beats perfect code. Keep changes small and on-task.
- Never commit secrets. Use `.env`, and document variable names through a reference (via the inbox).
