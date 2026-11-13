# D-0006: Scoring safeguards: eval clamping, penalty check, placeholder reward

- **Date:** 2026-11-13
- **Status:** accepted
- **Deciders:** Ufuk (approved an AI design choice from T-001)
- **Source:** inbox entry I-20261113-scoring-safeguards / task T-001

## Context
The illegal-move penalty (D-0004) must always be worse than any legal gap. Real Stockfish can report centipawn values beyond the mate score (e.g. tablebase wins), and the gap-to-reward mapping isn't decided.

## Decision
- Every eval is clamped to ±`mate_score` (default 10 000), so a legal gap is at most 2·`mate_score`.
- `ScoringConfig` refuses an `illegal_move_penalty` that isn't greater than 2·`mate_score` (default penalty 100 000).
- Default env reward = −gap. `reward_fn` is pluggable on `ChessLLMEnv` until the mapping is decided.
- Negative gaps are **not** clamped to 0. With real Stockfish at a fixed depth, the LLM's move can evaluate higher than the engine's "best" move. The mock engine never produces this.

## Alternatives considered
- **Clamping negative gaps to 0** — hides engine noise but loses information. Not decided; revisit with real Stockfish.

## Consequences
The penalty invariant can't be broken by config. Rewards are on a huge scale (up to −100 000), so normalize them before using an RL library.
