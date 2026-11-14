# D-0002: Build for the S-Pankki "Personal Economic Trainer" challenge

- **Date:** 2026-11-14
- **Status:** accepted
- **Deciders:** Team (stated by Ufuk)
- **Source:** team decision in chat, 2026-11-14

## Context
Earlier ideas (a chess RL environment, then a network stealth game for LLM evaluation) were dropped. The team needs one Junction 2026 challenge to target.

## Decision
We build for S-Pankki's "Personal Economic Trainer": an AI experience that lets people chat with their own banking data, built on S-Pankki's synthetic dataset. The brief and judging criteria are in [challenge.md](../references/challenge.md), the data in [dataset.md](../references/dataset.md). The concrete product idea is still to be described by the team.

## Alternatives considered
- **Chess RL environment** and **network stealth game:** dropped. That work is kept in git history and on the `new-idea` branch.

## Consequences
- Every feature should be checked against the five equally weighted judging criteria: financial literacy (incl. the three baskets), originality of the AI integration, mobile UX clarity, feasibility, and fit with S-mobiili.
- Only the provided synthetic data and open data are used; no real customer data.
