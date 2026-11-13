"""Gymnasium environment: observation = FEN, action = raw LLM text, one step = one scored move.

Each step is an independent position from the PositionSource (puzzle-style); the game is
not continued after the LLM's move. An episode is `episode_length` positions.
"""

from __future__ import annotations

import string
from typing import Any, Callable

import chess
import gymnasium as gym
from gymnasium import spaces

from chess_rl.interfaces import Engine, PositionSource
from chess_rl.scoring import MoveResult, ScoringConfig, score_move

FEN_CHARSET = "".join(sorted(set("pnbrqkPNBRQK12345678/ -abcdefghw0123456789")))
TEXT_CHARSET = string.printable
RewardFn = Callable[[MoveResult], float]


def default_reward(result: MoveResult) -> float:
    """Placeholder until the gap->reward mapping is decided: reward = -gap."""
    return 0.0 - result.gap  # not `-gap`: avoids -0.0 for a perfect move


class ChessLLMEnv(gym.Env[str, str]):
    metadata = {"render_modes": ["ansi"]}

    def __init__(
        self,
        position_source: PositionSource,
        engine: Engine,
        scoring_config: ScoringConfig | None = None,
        episode_length: int = 10,
        reward_fn: RewardFn = default_reward,
        render_mode: str | None = None,
    ) -> None:
        if episode_length < 1:
            raise ValueError("episode_length must be >= 1")
        if render_mode is not None and render_mode not in self.metadata["render_modes"]:
            raise ValueError(f"unsupported render_mode {render_mode!r}")
        self.position_source = position_source
        self.engine = engine
        self.scoring_config = scoring_config or ScoringConfig()
        self.episode_length = episode_length
        self.reward_fn = reward_fn
        self.render_mode = render_mode
        self.observation_space = spaces.Text(max_length=100, charset=FEN_CHARSET)
        self.action_space = spaces.Text(min_length=0, max_length=200, charset=TEXT_CHARSET)
        self._board: chess.Board | None = None
        self._steps = 0

    def reset(
        self, *, seed: int | None = None, options: dict[str, Any] | None = None
    ) -> tuple[str, dict[str, Any]]:
        super().reset(seed=seed)
        self.position_source.reset(seed)
        self._steps = 0
        self._board = chess.Board(self.position_source.next_position())
        return self._board.fen(), {}

    def step(self, action: str) -> tuple[str, float, bool, bool, dict[str, Any]]:
        if self._board is None:
            raise RuntimeError("call reset() before step()")
        if self._steps >= self.episode_length:
            raise RuntimeError("episode is over; call reset()")
        result = score_move(self._board, action, self.engine, self.scoring_config)
        reward = float(self.reward_fn(result))
        self._steps += 1
        terminated = self._steps >= self.episode_length
        if not terminated:
            self._board = chess.Board(self.position_source.next_position())
        return self._board.fen(), reward, terminated, False, {"result": result}

    def render(self) -> str | None:
        if self.render_mode == "ansi" and self._board is not None:
            return str(self._board)
        return None
