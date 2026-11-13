"""Pluggable parts of the framework.

Real implementations (Stockfish, an LLM API, a position dataset) only need to
satisfy these protocols; nothing else in the framework has to change.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import chess
import chess.engine


@runtime_checkable
class PositionSource(Protocol):
    """Supplies the positions the LLM is asked to play from."""

    def reset(self, seed: int | None = None) -> None:
        """Restart the sequence. The same seed must give the same sequence."""
        ...

    def next_position(self) -> str:
        """Return the next position as a FEN string."""
        ...


@runtime_checkable
class Engine(Protocol):
    """Reference engine (Stockfish in production)."""

    def best_move(self, board: chess.Board) -> chess.Move:
        """Best legal move for the side to move. `board` must not be mutated."""
        ...

    def evaluate(self, board: chess.Board) -> chess.engine.PovScore:
        """Evaluation of `board`, the same type `chess.engine.SimpleEngine.analyse`
        returns in `info["score"]`. `board` must not be mutated."""
        ...


@runtime_checkable
class LLMPlayer(Protocol):
    """The agent being evaluated."""

    def choose_move(self, fen: str) -> str:
        """Raw LLM output for the position. It may be illegal or not a move at all."""
        ...
