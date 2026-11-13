# D-0003: Score LLM moves by the Stockfish eval gap

- **Date:** 2026-11-13
- **Status:** accepted
- **Deciders:** Team (stated by Ufuk)
- **Source:** initial project setup

## Context
The project is a chess reinforcement-learning environment (framework) for LLMs. It needs a per-move quality signal for the LLM's moves.

## Decision
For a position `P`:
1. The LLM proposes `m_llm`, and Stockfish gives its best move `m_sf`.
2. Stockfish evaluates both resulting positions, `P + m_llm` and `P + m_sf`, from the mover's point of view.
3. **Score = eval(P + m_sf) − eval(P + m_llm)**. 0 means the LLM's move is as good as Stockfish's best. A larger gap means a worse move.

## Alternatives considered
- Not recorded.

## Consequences
- Every scored move needs at least two Stockfish evaluations, so engine speed limits throughput.
- Still open: search depth or time per eval, mate-score handling, how to score illegal or unparseable LLM moves, and how the gap maps to an RL reward.
