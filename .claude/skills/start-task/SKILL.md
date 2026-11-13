---
name: start-task
description: Start working on a task from docs/tasks. Use when the user says "start task X", "/start-task X", or asks to pick up or continue a task.
argument-hint: <task id like T-003, or words from the title>
---

# Start task: $ARGUMENTS

## 1. Find the task
- Search `docs/tasks/to-do/**/` for a file that matches `$ARGUMENTS` (an ID like `T-003`, or words from the filename or title).
- If nothing matches, or several files match, list the candidates (id, title, owner, status) and ask which one.
- If `$ARGUMENTS` is empty, list the open tasks grouped by owner and ask which one to start.

## 2. Load context (keep it lean)
1. Read the task file in full.
2. Read `docs/references/README.md` and `docs/decisions/README.md`. Open only the docs the task links to or obviously needs.
3. Search `docs/inbox.md` for entries that mention this task ID. They are **unverified**: use them, but say so if you rely on one.
4. Read only the code the task touches.

## 3. Claim it
- If `owner: unassigned`, ask the user who takes the task. Move the file to `docs/tasks/to-do/<Owner>/` and update `owner`.
- Set `status: in-progress`. Append `- YYYY-MM-DD: started` under **Progress**.
- If the task was already `in-progress`, read its Progress notes and resume from them instead of starting over.

## 4. Brief the user, then work
In a few lines: the goal, the steps you plan, the files you expect to touch, and open questions.
If the acceptance criteria are vague or conflict with a decision, ask before writing code. Otherwise, start.

## While working
- Update **Progress** at meaningful milestones, enough for another session to resume.
- Tick acceptance criteria as you meet them.
- When you find non-obvious knowledge, add an entry to `docs/inbox.md` (template: `docs/templates/inbox-entry.md`, with `Task:` set to this ID).
- For bugs or out-of-scope work, use the `new-task` skill. Don't grow this task.
- Never edit `docs/references/` or `docs/decisions/`.

## When the work is done
Summarize what changed, which inbox entries you added, and which tasks you created. Then remind the user of the next steps:
review `docs/inbox.md` → `/drain` → `/finish-task <id>`.
