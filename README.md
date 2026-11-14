# Junction26

Junction 2026 hackathon project. Team: Ufuk, Michal, Chamb.

Challenge: **S-Pankki – Personal Economic Trainer**. An AI coach that lets people chat with their own banking data.

> TODO: our idea, plus how to run it.

### Data
The challenge dataset is not in this repo. Download it once into `data/raw/` (gitignored):

```bash
mkdir -p data/raw
curl -L -o data/raw/tx_junction_transactions.csv https://media.githubusercontent.com/media/hackjunction/Junction-2026-S-pankki/main/tx_junction_transactions.csv
# the three small CSVs: "Download raw file" on https://github.com/hackjunction/Junction-2026-S-pankki
```

Details, schema and traps: `docs/references/dataset.md`.

## How we work with AI agents

`AGENTS.md` is the agent's entry point. `CLAUDE.md` only imports it.

| Command | Who runs it | What it does |
|---|---|---|
| `/start-task T-003` | you | Agent loads lean context, marks the task in-progress and works on it |
| `/new-task Michal fix login redirect` | you or the agent | Creates a task file. Agents also do this on their own when they find bugs |
| `/drain` | you, after reviewing | Moves **approved** inbox entries into `docs/references/` and `docs/decisions/` |
| `/finish-task T-003` | you | Runs checks, then deletes the task file (git history keeps it) |

### The loop
1. `/start-task T-003`
2. While the agent works, it writes non-obvious findings to `docs/inbox.md` and creates tasks for any bugs it finds.
3. **You review `docs/inbox.md`.** Fix or delete wrong entries, and tick `- [x] Approved` on the correct ones.
4. `/drain`
5. `/finish-task T-003`

### Where things live
- `docs/tasks/to-do/<Name>/`: your open tasks. Tasks with no owner go in `unassigned/`.
- `docs/references/`: verified facts the code doesn't show (DB schema, APIs, env, gotchas)
- `docs/decisions/`: verified architectural decisions
- `docs/inbox.md`: unverified AI proposals waiting for your review
- `docs/templates/`: templates for all of the above

Agents never write to `references/` or `decisions/` directly. Everything goes through the inbox and your review.
