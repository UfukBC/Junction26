"""Demo: one episode on mocks. Run with `python -m chess_rl [seed] [episode_length]`."""

from __future__ import annotations

import sys

from chess_rl.env import ChessLLMEnv
from chess_rl.mocks import MockEngine, MockLLMPlayer, MockPositionSource
from chess_rl.runner import run_episode


def main(argv: list[str]) -> None:
    seed = int(argv[0]) if argv else 0
    length = int(argv[1]) if len(argv) > 1 else 8
    env = ChessLLMEnv(MockPositionSource(), MockEngine(), episode_length=length)
    player = MockLLMPlayer(seed=seed, illegal_rate=0.2, garbage_rate=0.1)
    episode = run_episode(env, player, seed=seed)

    print(f"{'#':>2}  {'LLM output':<22} {'status':<11} {'LLM':<6} {'engine':<6} {'gap':>9} {'reward':>10}")
    for i, (r, reward) in enumerate(zip(episode.results, episode.rewards), 1):
        print(
            f"{i:>2}  {r.llm_output[:22]!r:<22} {r.status.value:<11} {r.llm_move or '-':<6} "
            f"{r.engine_move or '-':<6} {r.gap:>9.0f} {reward:>10.0f}"
        )
    mean = episode.mean_gap_legal
    print(
        f"\ntotal reward {episode.total_reward:.0f} | illegal/unparseable {episode.illegal_count} | "
        f"mean legal gap {'-' if mean is None else f'{mean:.0f}'}"
    )


if __name__ == "__main__":
    main(sys.argv[1:])
