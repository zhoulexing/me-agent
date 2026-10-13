"""Built-in adapters; this factory never prepares or resets remote resources."""

from pathlib import Path

from adapters.fixture import FixtureTarget
from adapters.yba.adapter import YbaTarget
from config import inside
from models import TargetConfig


def create_target(project: Path, config: TargetConfig, lease_index: int, *, fixture_root: Path | None = None):
    if config.kind == "fixture":
        return FixtureTarget(fixture_root or inside(project, config.fixtures))
    return YbaTarget(config, config.sessions[lease_index])
