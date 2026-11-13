# Framework architecture

> How the framework is wired and what a real implementation must satisfy to replace a mock.

**Last verified:** 2026-11-13

## Pluggable protocols
Defined in `src/chess_rl/interfaces.py`. Swap a mock by writing a class with these methods; no framework changes needed.

| Protocol | Methods | Notes |
|---|---|---|
| `PositionSource` | `reset(seed)`, `next_position() -> str` (FEN) | Same seed must give the same sequence |
| `Engine` | `best_move(board) -> chess.Move`, `evaluate(board) -> chess.engine.PovScore` | Must not mutate `board`. `PovScore` is exactly what `chess.engine.SimpleEngine.analyse(...)["score"]` returns, so a Stockfish wrapper can pass it straight through |
| `LLMPlayer` | `choose_move(fen) -> str` | Raw text; may be illegal or garbage |

## Flow
`ChessLLMEnv.reset()` → FEN → `LLMPlayer.choose_move` → `env.step(text)` → `score_move()` → `MoveResult` in `info["result"]`, reward = `reward_fn(result)`. `run_episode(env, player, seed)` in `runner.py` drives this loop. The LLM is the agent, outside the env.

## Units and conventions
- Evals are centipawns from the **mover's** point of view (`PovScore.pov(mover)`). Mate becomes ±(`mate_score` − plies), and every eval is clamped to ±`mate_score`.
- Moves in `MoveResult` are UCI. Input is accepted as UCI or SAN, strictly: one move, whitespace trimmed, no surrounding text.
- `MoveStatus`: `ok` / `illegal` (incl. ambiguous SAN and the null move) / `unparseable`.
- For illegal output the engine is not called (`engine_move` is `None`).
- If the LLM move equals the engine move, only one engine eval is made.
