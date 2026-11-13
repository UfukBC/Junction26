"""Move scoring, per D-0003 plus the illegal-move penalty.

gap = eval(P + engine_move) - eval(P + llm_move), from the mover's point of view, in centipawns.
0 = the LLM matched the engine; larger = worse. Illegal or unparseable output scores
`illegal_move_penalty`, which is always larger than any legal gap.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import Enum

import chess
import chess.engine

from chess_rl.interfaces import Engine


class MoveStatus(str, Enum):
    OK = "ok"
    ILLEGAL = "illegal"          # parsed as a move, but not legal here (incl. ambiguous SAN, null move)
    UNPARSEABLE = "unparseable"  # not a UCI or SAN move at all


@dataclass(frozen=True)
class ScoringConfig:
    # Mate scores are converted to centipawns as +/-(mate_score - plies to mate), and every
    # eval is clamped to [-mate_score, mate_score], so a legal gap is at most 2 * mate_score.
    mate_score: int = 10_000
    illegal_move_penalty: float = 100_000.0

    def __post_init__(self) -> None:
        if self.mate_score <= 0:
            raise ValueError("mate_score must be positive")
        if self.illegal_move_penalty <= 2 * self.mate_score:
            raise ValueError(
                "illegal_move_penalty must exceed 2 * mate_score (the largest possible legal gap)"
            )


@dataclass(frozen=True)
class MoveResult:
    fen: str
    llm_output: str
    status: MoveStatus
    gap: float                     # centipawns, or illegal_move_penalty
    llm_move: str | None = None    # UCI, when status is OK
    engine_move: str | None = None # UCI, when status is OK
    llm_eval: float | None = None  # mover's POV, clamped centipawns
    engine_eval: float | None = None

    @property
    def is_legal(self) -> bool:
        return self.status is MoveStatus.OK

    def to_dict(self) -> dict:
        d = asdict(self)
        d["status"] = self.status.value
        return d


def parse_move(board: chess.Board, text: str) -> tuple[MoveStatus, chess.Move | None]:
    """Parse LLM output strictly as one UCI or SAN move (surrounding whitespace allowed)."""
    text = text.strip()
    if not text:
        return MoveStatus.UNPARSEABLE, None
    try:
        move = board.parse_uci(text)
    except chess.IllegalMoveError:
        return MoveStatus.ILLEGAL, None
    except chess.InvalidMoveError:
        try:
            move = board.parse_san(text)
        except (chess.IllegalMoveError, chess.AmbiguousMoveError):
            return MoveStatus.ILLEGAL, None
        except chess.InvalidMoveError:
            return MoveStatus.UNPARSEABLE, None
    if not move:  # null move ("0000" / "--") is never a legal answer
        return MoveStatus.ILLEGAL, None
    return MoveStatus.OK, move


def _eval_after(
    board: chess.Board, move: chess.Move, engine: Engine, mover: chess.Color, config: ScoringConfig
) -> float:
    after = board.copy(stack=False)
    after.push(move)
    cp = engine.evaluate(after).pov(mover).score(mate_score=config.mate_score)
    return float(max(-config.mate_score, min(config.mate_score, cp)))


def score_move(
    board: chess.Board, llm_output: str, engine: Engine, config: ScoringConfig | None = None
) -> MoveResult:
    """Score one LLM answer for `board`. `board` is not mutated."""
    config = config or ScoringConfig()
    fen = board.fen()
    status, move = parse_move(board, llm_output)
    if move is None:
        # The engine isn't called for illegal output: the penalty doesn't depend on it.
        return MoveResult(fen, llm_output, status, gap=config.illegal_move_penalty)

    mover = board.turn
    engine_move = engine.best_move(board)
    engine_eval = _eval_after(board, engine_move, engine, mover, config)
    llm_eval = (
        engine_eval if move == engine_move else _eval_after(board, move, engine, mover, config)
    )
    return MoveResult(
        fen=fen,
        llm_output=llm_output,
        status=status,
        gap=engine_eval - llm_eval,
        llm_move=move.uci(),
        engine_move=engine_move.uci(),
        llm_eval=llm_eval,
        engine_eval=engine_eval,
    )
