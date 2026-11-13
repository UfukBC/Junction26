# D-0005: One env step = one independent position

- **Date:** 2026-11-13
- **Status:** accepted
- **Deciders:** Ufuk (approved an AI design choice from T-001)
- **Source:** inbox entry I-20261113-independent-positions / task T-001

## Context
The env needs to know what comes after the LLM's move: keep playing the same game, or move to a new position.

## Decision
Each step scores one move on a fresh position from the `PositionSource` (puzzle-style). The game is not continued. An episode is `episode_length` positions.

## Alternatives considered
- **Continue the game** (the opponent replies with Stockfish, the LLM moves again). That is closer to real play, but positions then depend on the LLM's earlier mistakes, which makes runs harder to compare. It can be added later as a second env.

## Consequences
Runs are reproducible from a seed and positions can come from any dataset. The env does not test long-term planning.
