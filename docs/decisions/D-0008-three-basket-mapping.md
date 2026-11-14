# D-0008: First mapping of transactions to the three baskets

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Ufuk (approved an AI draft; open points still to settle)
- **Source:** inbox entry I-20261114-three-basket-draft / task none

## Context
The brief's pedagogy splits spending into mandatory regular, mandatory irregular, and everyday "slips through your fingers". The data has categories, transaction types and MCC codes, but no basket label.

## Decision
- **Mandatory regular:** `housing_payment`, `utilities_payment`.
- **Mandatory irregular:** Health purchases (pharmacy, doctors, dentists: MCC 5912/8011/8021/8099), and large one-off Home & Tech purchases (e.g. appliances; threshold to decide, e.g. ≥ 300 €).
- **Everyday leak:** Restaurants, Entertainment, small Lifestyle and Home & Tech purchases, taxis (MCC 4121).
- **Open:** Groceries and fuel/commuting are needed but frequent: put them in a "regular essentials" view or in everyday? Large Travel/Lifestyle purchases are discretionary but not "everyday"; they may need their own label. Savings (`investment_deposit`) and transfers out (`salary_sweep`) are not spending.

## Alternatives considered
- **Let the LLM classify every transaction:** flexible, but slow over 3.6 M rows and not reproducible; better as an explanation layer on top of a rule-based mapping.

## Consequences
The mapping must be explainable to the user ("why is this in everyday?") and editable, in the MyData spirit.
