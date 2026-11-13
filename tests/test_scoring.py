import chess
import pytest

from chess_rl.mocks import MOCK_POSITIONS, MockEngine
from chess_rl.scoring import MoveStatus, ScoringConfig, parse_move, score_move

WHITE_WINS_QUEEN = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1"
BLACK_WINS_QUEEN = "4k3/8/8/4p3/3Q4/8/8/4K3 b - - 0 1"
MATE_IN_ONE = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"

engine = MockEngine()
config = ScoringConfig()


def score(fen: str, output: str):
    return score_move(chess.Board(fen), output, engine, config)


@pytest.mark.parametrize("fen", MOCK_POSITIONS)
def test_engine_move_scores_zero(fen):
    board = chess.Board(fen)
    r = score(fen, engine.best_move(board).uci())
    assert r.status is MoveStatus.OK
    assert r.gap == 0
    assert r.llm_move == r.engine_move


def test_worse_move_white_to_move():
    r = score(WHITE_WINS_QUEEN, "Ke2")
    assert r.engine_move == "e4d5"
    assert r.engine_eval == 100   # pawn vs nothing
    assert r.llm_eval == -800     # pawn vs queen
    assert r.gap == 900


def test_worse_move_black_to_move_uses_movers_perspective():
    r = score(BLACK_WINS_QUEEN, "e8e7")
    assert r.engine_move == "e5d4"
    assert r.engine_eval == 100
    assert r.llm_eval == -800
    assert r.gap == 900


def test_missed_mate():
    r = score(MATE_IN_ONE, "Kg2")
    assert r.engine_move == "a1a8"
    assert r.engine_eval == config.mate_score
    assert r.gap == config.mate_score - 200  # rook vs three pawns after Kg2


def test_uci_and_san_are_equivalent():
    assert score(WHITE_WINS_QUEEN, "exd5").gap == score(WHITE_WINS_QUEEN, "e4d5").gap == 0
    assert score(WHITE_WINS_QUEEN, "  e4d5\n").status is MoveStatus.OK


@pytest.mark.parametrize(
    "output, status",
    [
        ("e1e3", MoveStatus.ILLEGAL),      # king can't jump two squares
        ("Qh5", MoveStatus.ILLEGAL),       # white has no queen
        ("0000", MoveStatus.ILLEGAL),      # null move
        ("", MoveStatus.UNPARSEABLE),
        ("   ", MoveStatus.UNPARSEABLE),
        ("I play the pawn", MoveStatus.UNPARSEABLE),
        ("e9e10", MoveStatus.UNPARSEABLE),
    ],
)
def test_illegal_and_unparseable_get_penalty(output, status):
    r = score(WHITE_WINS_QUEEN, output)
    assert r.status is status
    assert r.gap == config.illegal_move_penalty
    assert r.llm_move is None and r.engine_move is None


def test_ambiguous_san_is_illegal():
    # Both knights can reach d2.
    status, move = parse_move(chess.Board("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1"), "Nd2")
    assert status is MoveStatus.ILLEGAL and move is None


def test_penalty_is_worse_than_every_legal_move_in_mock_data():
    worst_legal = max(
        score(fen, move.uci()).gap
        for fen in MOCK_POSITIONS
        for move in chess.Board(fen).legal_moves
    )
    assert worst_legal < config.illegal_move_penalty


def test_gap_never_negative_with_mock_engine():
    for fen in MOCK_POSITIONS:
        for move in chess.Board(fen).legal_moves:
            assert score(fen, move.uci()).gap >= 0


def test_config_rejects_penalty_not_above_max_legal_gap():
    with pytest.raises(ValueError):
        ScoringConfig(mate_score=10_000, illegal_move_penalty=20_000)
    ScoringConfig(mate_score=10_000, illegal_move_penalty=20_001)


def test_board_is_not_mutated():
    board = chess.Board(WHITE_WINS_QUEEN)
    score_move(board, "Ke2", engine, config)
    assert board.fen() == WHITE_WINS_QUEEN
