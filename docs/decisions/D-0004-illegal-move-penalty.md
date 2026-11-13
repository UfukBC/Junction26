# D-0004: Illegal LLM moves get a huge fixed penalty

- **Date:** 2026-11-13
- **Status:** accepted
- **Deciders:** Ufuk
- **Source:** inbox entry I-20261113-illegal-move-penalty / task T-001

## Context
D-0003 scores legal moves by the Stockfish eval gap. An illegal move has no resulting position to evaluate, so it needs its own rule.

## Decision
An illegal move from the LLM gets a huge fixed penalty instead of an eval-gap score. The penalty must be far worse than the gap of any legal move, so the agent always learns that an illegal move is worse than the worst legal one. The exact value is a config constant. Output that can't be parsed as a move is treated the same as an illegal move.

## Alternatives considered
- Not recorded.

## Consequences
The penalty value has to stay above the largest possible legal-move gap, including mate scores. Revisit it once mate-score handling is decided.
