# D-0001: Docs and task workflow (inbox → review → drain)

- **Date:** 2026-11-13
- **Status:** accepted
- **Deciders:** Team (set up by Ufuk)
- **Source:** initial project setup

## Context
A 3-person hackathon team works with AI agents. Each new agent session spends a lot of tokens re-learning the codebase. Knowledge an AI writes down unchecked can be wrong, and later agents would repeat the error with confidence.

## Decision
- `AGENTS.md` is the single entry point for agents. `CLAUDE.md` only imports it, so Claude Code loads it automatically.
- `docs/references/` (facts) and `docs/decisions/` (choices) hold **human-verified** knowledge only. Agents read them but never write to them.
- Agents propose knowledge in `docs/inbox.md`. Humans review it and tick `Approved`. `/drain` moves approved entries into references and decisions.
- Tasks are markdown files under `docs/tasks/to-do/<Owner>/`. Agents create tasks for any bugs or out-of-scope work they find. `/start-task` begins a task, and `/finish-task` deletes the task file once the task is done. Git history keeps the old task files.
- Task IDs (`T-NNN`) never get reused. The next ID comes from the highest ID in the working tree or anywhere in git history.

## Alternatives considered
- **GitHub Issues for tasks.** Agents would need API calls, which cost tokens and need auth. Files are faster for a 48h event.
- **Agents write docs directly.** Unverified knowledge would pile up. Review is cheap with the inbox.
- **Archive finished tasks.** That clutters the tree. Git history already keeps them.

## Consequences
- Docs stay trustworthy, but only as current as the team's reviews. Review the inbox regularly.
- `docs/inbox.md` gets merge conflicts when several people append at once. Resolve them by keeping both sides.
