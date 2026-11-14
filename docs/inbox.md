# Inbox: knowledge waiting for review

AI agents append entries here instead of editing `docs/references/` or `docs/decisions/`.

**Reviewers:** for each entry, check it against the code or reality. Fix or delete it if it's wrong, then tick `- [x] Approved`.
Run `/drain` to move approved entries into the docs. `/drain` leaves unticked entries alone.

Format: `docs/templates/inbox-entry.md`. Put new entries at the bottom. If you get a merge conflict here, keep both sides.

---

<!-- entries below this line -->

### I-20261114-sparse-final-month

- [ ] Approved
- **Type:** reference
- **Target:** `docs/references/dataset.md` (existing, section "Transactions")
- **Task:** none
- **Author:** AI
- **Evidence:** `CUST04457` has 13 purchases / 637 € in 2026-08 but only 3 purchases / 87 € in 2026-09; `python3` count over `data/raw/tx_junction_transactions.csv`.

The last dataset month (2026-09) is noticeably sparse for some customers: `CUST04457` has only 3 purchases (87 €) against 13 (637 €) in August, and no restaurant rows at all in Aug–Sep. Because the app opens on the latest month, demos must either add synthetic rows (see `DEMO_MONTH_FILL` in `src/frontend/scripts/build-demo-db.mjs`) or open on an earlier month.
