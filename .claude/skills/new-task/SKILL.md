---
name: new-task
description: Create a task file in docs/tasks/to-do. Use when the user asks to add or create a task, AND on your own whenever you discover a bug, missing piece, or out-of-scope work while doing something else.
argument-hint: [owner] <what needs doing>
---

# New task: $ARGUMENTS

## 1. Pick the next ID (IDs are never reused)
Take the highest `T-NNN` that appears in any of these places and add 1:
- file names under `docs/tasks/` in the working tree
- git history of task files: `git log --all --name-only --format= -- docs/tasks`, which also covers deleted tasks
- `T-NNN` mentioned anywhere in `docs/` (decisions and references cite their source task)
- commit messages: `git log --all --format=%B`

The last two catch tasks whose file was created and deleted without ever being committed.

Zero-pad the number to 3 digits (`T-007`). If git isn't available, use the working tree only.

## 2. Pick the owner
- If the user named one, use that owner.
- Otherwise, if the **Team & ownership** table in `AGENTS.md` makes the area's owner clear, assign it to them.
- Otherwise, use `unassigned`.

## 3. Write the file
- Copy `docs/templates/task.md` to `docs/tasks/to-do/<Owner>/T-NNN-<kebab-slug>.md` (slug of 5 words or fewer). Use `docs/tasks/to-do/unassigned/` when there is no owner.
- Fill in every frontmatter field. `created` is today. `created-by: ai` if you created the task without being asked, otherwise `human`.
- Keep acceptance criteria concrete and checkable.
- **For bugs**, Context must include: location (`file:line`), steps to reproduce, observed vs expected behavior, and evidence (error output, a failing input). Put any fix idea under a "Suggested approach" heading, not as a fact.

## 4. Don't start it
Tell the user in one line: `Created T-NNN (<owner>): <title>`. Then go back to what you were doing.
