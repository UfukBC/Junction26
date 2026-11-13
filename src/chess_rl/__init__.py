"""Chess RL environment for LLMs: LLM moves are scored by the Stockfish eval gap (D-0003)."""

from chess_rl.env import ChessLLMEnv, default_reward
from chess_rl.interfaces import Engine, LLMPlayer, PositionSource
from chess_rl.runner import EpisodeResult, run_episode
from chess_rl.scoring import MoveResult, MoveStatus, ScoringConfig, parse_move, score_move

__all__ = [
    "ChessLLMEnv",
    "default_reward",
    "Engine",
    "LLMPlayer",
    "PositionSource",
    "EpisodeResult",
    "run_episode",
    "MoveResult",
    "MoveStatus",
    "ScoringConfig",
    "parse_move",
    "score_move",
]
