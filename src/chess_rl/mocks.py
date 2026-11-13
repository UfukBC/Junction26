"""Deterministic stand-ins for the real position source, Stockfish and the LLM.

Replace with real implementations of the protocols in `chess_rl.interfaces`.
"""

from __future__ import annotations

import random

import chess
import chess.engine

MOCK_POSITIONS: tuple[str, ...] = (
    chess.STARTING_FEN,
    # White to move, exd5 wins the queen.
    "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1",
    # Black to move, exd4 wins the queen (checks the mover's perspective).
    "4k3/8/8/4p3/3Q4/8/8/4K3 b - - 0 1",
    # White to move, Ra8# is mate in one.
    "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    # Italian game, quiet middlegame.
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
)

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 300,
    chess.BISHOP: 300,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}


class MockPositionSource:
    """Cycles through a fixed list of FENs, shuffled by the seed."""

    def __init__(self, positions: tuple[str, ...] | list[str] = MOCK_POSITIONS) -> None:
        if not positions:
            raise ValueError("positions must not be empty")
        self._positions = list(positions)
        self._order = list(self._positions)
        self._i = 0

    def reset(self, seed: int | None = None) -> None:
        self._order = list(self._positions)
        random.Random(seed).shuffle(self._order)
        self._i = 0

    def next_position(self) -> str:
        fen = self._order[self._i % len(self._order)]
        self._i += 1
        return fen


class MockEngine:
    """Material-only, one-ply "engine". `best_move` maximizes `evaluate`, so gaps are never negative."""

    def evaluate(self, board: chess.Board) -> chess.engine.PovScore:
        if board.is_checkmate():
            return chess.engine.PovScore(chess.engine.Mate(-0), board.turn)
        if board.is_stalemate() or board.is_insufficient_material():
            return chess.engine.PovScore(chess.engine.Cp(0), board.turn)
        material = 0
        for piece in board.piece_map().values():
            value = PIECE_VALUES[piece.piece_type]
            material += value if piece.color == board.turn else -value
        return chess.engine.PovScore(chess.engine.Cp(material), board.turn)

    def best_move(self, board: chess.Board) -> chess.Move:
        mover = board.turn
        best_score: int | None = None
        best_move: chess.Move | None = None
        # Sorted so ties resolve to the first move in UCI order (deterministic).
        for move in sorted(board.legal_moves, key=lambda m: m.uci()):
            after = board.copy(stack=False)
            after.push(move)
            score = self.evaluate(after).pov(mover).score(mate_score=100_000)
            if best_score is None or score > best_score:
                best_score, best_move = score, move
        if best_move is None:
            raise ValueError("no legal moves in position")
        return best_move


class MockLLMPlayer:
    """Seeded random player: mostly legal moves (UCI or SAN), sometimes illegal or garbage."""

    GARBAGE = (
        "",
        "I think the knight should go forward.",
        "e9e10",
        "Resign",
    )

    def __init__(self, seed: int | None = None, illegal_rate: float = 0.1, garbage_rate: float = 0.05) -> None:
        if illegal_rate < 0 or garbage_rate < 0 or illegal_rate + garbage_rate > 1:
            raise ValueError("rates must be non-negative and sum to at most 1")
        self._rng = random.Random(seed)
        self.illegal_rate = illegal_rate
        self.garbage_rate = garbage_rate

    def choose_move(self, fen: str) -> str:
        board = chess.Board(fen)
        roll = self._rng.random()
        if roll < self.garbage_rate:
            return self._rng.choice(self.GARBAGE)
        if roll < self.garbage_rate + self.illegal_rate:
            return self._illegal_uci(board)
        move = self._rng.choice(sorted(board.legal_moves, key=lambda m: m.uci()))
        return move.uci() if self._rng.random() < 0.5 else board.san(move)

    def _illegal_uci(self, board: chess.Board) -> str:
        legal = {m.uci() for m in board.legal_moves}
        while True:
            a, b = self._rng.sample(chess.SQUARES, 2)
            uci = chess.square_name(a) + chess.square_name(b)
            if uci not in legal:
                return uci
