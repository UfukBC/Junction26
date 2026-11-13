---
name: drain
description: Move human-approved entries from docs/inbox.md into docs/references and docs/decisions. Runs only when the user invokes /drain.
disable-model-invocation: true
---

# Drain the inbox

This is the **only** path by which content enters `docs/references/` and `docs/decisions/`.

## 1. Collect approved entries
Read `docs/inbox.md`. Collect only the entries marked `- [x] Approved`. Leave unticked entries exactly as they are.
If nothing is approved, report the number of pending entries and stop.

## 2. Move each approved entry
Use the entry's content as written. Humans may have edited it, and their edits win. Change formatting only as much as the target needs. **Never add information that isn't in the entry.**

**Type: reference**
- If the target file in `docs/references/` exists, add the content as a section in the right place. If it contradicts existing text, replace the old text (the approved entry is newer) and mention the replacement in your report.
- If the target file is new, create it from `docs/templates/reference.md`.
- Set **Last verified** to today.
- Update `docs/references/README.md` so it has one row per file, using the file's one-line summary. Remove the `_none yet_` row once a real row exists.

**Type: decision**
- Create `docs/decisions/D-NNNN-<slug>.md` from `docs/templates/decision.md`. NNNN is the highest existing number plus 1, zero-padded to 4 digits.
- Set **Source** to the inbox entry ID and its task.
- If the entry supersedes `D-XXXX`, change that file's Status to `superseded by D-NNNN` and update its row in the index. This is the only edit allowed to an existing decision.
- Add a row to `docs/decisions/README.md`.

## 3. Skip what's unclear
If an approved entry has no clear target, or contradicts a decision without saying it supersedes it, leave it in the inbox and ask the user about it.

## 4. Clean up and report
- Remove the drained entries from `docs/inbox.md`. Keep the header and every unticked or skipped entry.
- Report a table (entry ID → destination file, plus whether it was new, appended or replaced), then the number of entries still pending.
