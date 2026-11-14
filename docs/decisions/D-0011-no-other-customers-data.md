# D-0011: Features use only the user's own data; comparisons use only public Finnish consumption statistics

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Team (stated by Ufuk)
- **Source:** inbox entry I-20261114-no-other-customers-data / task T-014, T-016

## Context
The dataset contains thousands of customers, which makes cross-customer statistics easy ("people your age spend…", "you spend more than most"). The team states it is not legally allowed to use other S-Bank users' data for our features.

## Decision
- Every number, warning, insight and AI text for a user is derived from **that user's own transactions** (and their own questionnaire answers) only.
- Any comparison with others ("benchmark") uses **only** the public Statistics Finland household budget survey data in `src/frontend/src/data/benchmarks.json` (the [Finnish consumption statistics](../docs/references/finnish-consumption-statistics.md) reference, `src/frontend/BENCHMARKS.md`).
- No feature, query, threshold, prompt or AI input may aggregate over several customers (percentiles, medians or "typical" values computed from other customers).
- Demo customers were picked once while building the demo; the docs describe them with their own numbers only.

## Alternatives considered
- **Cross-customer comparisons from the dataset:** rejected on legal grounds.

## Consequences
- T-014 insights and T-015 AI inputs must not use peer statistics; "vs average" can only mean the Statistics Finland figures.
- T-016's time-habit warning already follows this: all thresholds are relative to the user's own history.
- Open point for the team: whether the one-off analysis used to *choose* demo customers (looking at the whole synthetic dataset) is acceptable. The product never does this at runtime.
