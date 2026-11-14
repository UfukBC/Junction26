# Inbox: knowledge waiting for review

AI agents append entries here instead of editing `docs/references/` or `docs/decisions/`.

**Reviewers:** for each entry, check it against the code or reality. Fix or delete it if it's wrong, then tick `- [x] Approved`.
Run `/drain` to move approved entries into the docs. `/drain` leaves unticked entries alone.

Format: `docs/templates/inbox-entry.md`. Put new entries at the bottom. If you get a merge conflict here, keep both sides.

---

<!-- entries below this line -->

---

### I-20261114-three-basket-draft

- [ ] Approved
- **Type:** decision
- **Target:** new decision
- **Task:** none
- **Author:** AI (draft for discussion, needs team approval)
- **Evidence:** `docs/references/dataset.md` (housing: 1/month, CV 0.03; utilities: ~3/month; purchases ≥500 € concentrated in Home & Tech, Lifestyle, Travel, Health); challenge brief's three baskets

**Title:** First mapping of transactions to the three baskets

**Context:** The brief's pedagogy splits spending into mandatory regular, mandatory irregular, and everyday "slips through your fingers". The data has categories, transaction types and MCC codes, but no basket label.

**Decision (draft):**
- **Mandatory regular:** `housing_payment`, `utilities_payment`.
- **Mandatory irregular:** Health purchases (pharmacy, doctors, dentists: MCC 5912/8011/8021/8099), and large one-off Home & Tech purchases (e.g. appliances; threshold to decide, e.g. ≥ 300 €).
- **Everyday leak:** Restaurants, Entertainment, small Lifestyle and Home & Tech purchases, taxis (MCC 4121).
- **Open:** Groceries and fuel/commuting are needed but frequent: put them in a "regular essentials" view or in everyday? Large Travel/Lifestyle purchases are discretionary but not "everyday"; they may need their own label. Savings (`investment_deposit`) and transfers out (`salary_sweep`) are not spending.

**Alternatives considered:**
- **Let the LLM classify every transaction:** flexible, but slow over 3.6 M rows and not reproducible; better as an explanation layer on top of a rule-based mapping.

**Consequences:** The mapping must be explainable to the user ("why is this in everyday?") and editable, in the MyData spirit.
