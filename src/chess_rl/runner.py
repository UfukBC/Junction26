"""Drive an LLMPlayer through a ChessLLMEnv episode."""

from __future__ import annotations

from dataclasses import dataclass, field

from chess_rl.env import ChessLLMEnv
from chess_rl.interfaces import LLMPlayer
from chess_rl.scoring import MoveResult


@dataclass
class EpisodeResult:
    results: list[MoveResult] = field(default_factory=list)
    rewards: list[float] = field(default_factory=list)

    @property
    def total_reward(self) -> float:
        return sum(self.rewards)

    @property
    def mean_gap_legal(self) -> float | None:
        gaps = [r.gap for r in self.results if r.is_legal]
        return sum(gaps) / len(gaps) if gaps else None

    @property
    def illegal_count(self) -> int:
        return sum(not r.is_legal for r in self.results)


def run_episode(env: ChessLLMEnv, player: LLMPlayer, seed: int | None = None) -> EpisodeResult:
    episode = EpisodeResult()
    fen, _ = env.reset(seed=seed)
    done = False
    while not done:
        fen, reward, terminated, truncated, info = env.step(player.choose_move(fen))
        episode.results.append(info["result"])
        episode.rewards.append(reward)
        done = terminated or truncated
    return episode
