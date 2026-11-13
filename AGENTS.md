# Junction26 — Agent Guide

Hackathon project for Junction 2026. Team: **Ufuk, Michal, Chamb**.
Every AI agent starts here. Read this file in full. Read everything else only when the task needs it.

## Project

A **chess reinforcement-learning environment (framework) for LLMs**. The LLM plays moves. Each move is scored by comparing it with Stockfish's best move:

1. Take position `P`. The LLM proposes move `m_llm`, and Stockfish finds its best move `m_sf`.
2. Stockfish evaluates both resulting positions, `P + m_llm` and `P + m_sf`, from the mover's point of view.
3. **Score = eval(P + m_sf) − eval(P + m_llm)**, the point gap between them. 0 means the LLM matched Stockfish's best; a larger gap means a worse move. This gap is the signal the RL environment exposes. See [D-0003](docs/decisions/D-0003-move-scoring-stockfish-eval-gap.md).

Open questions (not decided yet): Stockfish depth or time limit per eval, how to handle mate scores, the final illegal-move penalty value (rule: [D-0004](docs/decisions/D-0004-illegal-move-penalty.md)), how the gap maps to an RL reward (placeholder −gap: [D-0006](docs/decisions/D-0006-scoring-safeguards.md)), whether to clamp negative gaps, and which challenge/demo this targets.

- Language: **Python** ([D-0002](docs/decisions/D-0002-python.md))
- Engine: Stockfish
- Setup: `python -m venv .venv`, then `.venv\Scripts\python -m pip install -e ".[dev]"`
- Demo (on mocks): `.venv\Scripts\python -m chess_rl [seed] [episode_length]`
- Tests: `.venv\Scripts\python -m pytest -q`

## Repo map

| Path | What's there |
|---|---|
| `src/chess_rl/` | The framework: `interfaces.py` (pluggable protocols), `scoring.py` (D-0003 + illegal-move penalty), `env.py` (Gymnasium env), `runner.py`, `mocks.py`, `__main__.py` (demo) |
| `tests/` | pytest suite |
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

- Python ≥ 3.10, pip + venv, pytest. Formatter/linter: TODO.
- Hackathon pace: a working demo beats perfect code. Keep changes small and on-task.
- Never commit secrets. Use `.env`, and document variable names through a reference (via the inbox).
