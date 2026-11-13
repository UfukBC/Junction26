import chess
import pytest
from gymnasium.utils.env_checker import check_env

from chess_rl import ChessLLMEnv, ScoringConfig, run_episode
from chess_rl.interfaces import Engine, LLMPlayer, PositionSource
from chess_rl.mocks import MockEngine, MockLLMPlayer, MockPositionSource


def make_env(**kwargs) -> ChessLLMEnv:
    return ChessLLMEnv(MockPositionSource(), MockEngine(), **kwargs)


def test_mocks_satisfy_protocols():
    assert isinstance(MockPositionSource(), PositionSource)
    assert isinstance(MockEngine(), Engine)
    assert isinstance(MockLLMPlayer(), LLMPlayer)


def test_gymnasium_env_checker():
    check_env(make_env(episode_length=3), skip_render_check=True)


def test_episode_runs_for_episode_length():
    env = make_env(episode_length=7)
    episode = run_episode(env, MockLLMPlayer(seed=1), seed=1)
    assert len(episode.results) == len(episode.rewards) == 7
    assert episode.rewards == [-r.gap for r in episode.results]


def test_seeded_runs_are_reproducible():
    a = run_episode(make_env(), MockLLMPlayer(seed=3), seed=3)
    b = run_episode(make_env(), MockLLMPlayer(seed=3), seed=3)
    assert [r.to_dict() for r in a.results] == [r.to_dict() for r in b.results]


def test_illegal_action_gets_penalty_reward():
    env = make_env(episode_length=1)
    env.reset(seed=0)
    _, reward, terminated, truncated, info = env.step("not a move")
    assert reward == -ScoringConfig().illegal_move_penalty
    assert not info["result"].is_legal
    assert terminated and not truncated


def test_custom_reward_fn():
    env = make_env(episode_length=1, reward_fn=lambda r: 1.0 if r.gap == 0 else 0.0)
    fen, _ = env.reset(seed=0)
    best = MockEngine().best_move(chess.Board(fen)).uci()
    _, reward, *_ = env.step(best)
    assert reward == 1.0


def test_step_after_episode_end_raises():
    env = make_env(episode_length=1)
    env.reset(seed=0)
    env.step("e2e4")
    with pytest.raises(RuntimeError):
        env.step("e2e4")


def test_step_before_reset_raises():
    with pytest.raises(RuntimeError):
        make_env().step("e2e4")
