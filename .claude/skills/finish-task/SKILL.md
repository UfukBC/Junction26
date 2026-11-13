---
name: finish-task
description: Close a finished task by deleting its task file. Runs only when the user invokes /finish-task.
disable-model-invocation: true
argument-hint: <task id like T-003>
---

# Finish task: $ARGUMENTS

## 1. Find the task
Search `docs/tasks/to-do/**/` for `$ARGUMENTS`. If nothing matches, or several files match, list the candidates and ask.

## 2. Pre-delete checks
Once the file is deleted, its content is gone from the working tree, so check these first:
- **Unticked acceptance criteria.** List them and ask whether to finish anyway.
- **Inbox entries that mention this task ID** in `docs/inbox.md`:
  - entries that are approved but not drained: suggest running `/drain` first
  - unreviewed entries: warn that they will stay in the inbox until someone reviews them
- **Knowledge only in the task file.** If the Progress notes contain something future agents need (a gotcha, a schema detail, a decision) that isn't in the inbox, offer to write inbox entries for it before deleting.

If any check finds something, report it and wait for the user's go-ahead. If every check is clean, continue.

## 3. Delete
Delete the task file. Use `git rm` if the file is tracked, otherwise a plain delete. Git history keeps the file.

## 4. Report
`Finished T-NNN: <title>. Task file deleted.` Also list any follow-up tasks created during the work, and the number of inbox entries still pending for it.
