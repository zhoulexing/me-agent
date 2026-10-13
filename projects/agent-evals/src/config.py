"""Project-relative inputs and an independent evaluation state directory."""

import hashlib
import json
import os
from pathlib import Path
from typing import TypeVar

import yaml
from pydantic import BaseModel

from models import EvalCase, Experiment, Suite, TargetConfig

T = TypeVar("T", bound=BaseModel)


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def inside(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"path escapes project root: {relative}")
    return path


class EvalConfig:
    def __init__(self, project: Path, state_dir: Path | None = None):
        self.project = project.resolve()
        configured = os.environ.get("AGENT_EVALS_STATE_DIR") or os.environ.get("CLAW_EVALS_STATE_DIR")
        # Preserve existing state and permanent session leases after the directory rename.
        legacy_state = self.project / ".claw-evals"
        default_state = legacy_state if legacy_state.exists() else self.project / ".agent-evals"
        self.state_dir = (state_dir or Path(configured or default_state)).resolve()

    def load(self, path: str, model: type[T]) -> T:
        source = inside(self.project, path)
        if source.stat().st_size > 2_000_000:
            raise ValueError("definition exceeds 2 MB")
        try:
            value = yaml.safe_load(source.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            # Parser diagnostics can quote credentials accidentally placed in YAML.
            raise ValueError(f"invalid YAML: {source.name}") from exc
        return model.model_validate(value)

    def suite(self, path: str) -> tuple[Suite, list[EvalCase]]:
        from graders import validate_grader

        suite = self.load(path, Suite)
        cases = [self.load(p, EvalCase) for p in suite.cases]
        if len({c.case_id for c in cases}) != len(cases):
            raise ValueError("duplicate case_id in suite")
        for case in cases:
            for grader in case.graders:
                validate_grader(grader)
        return suite, cases

    def experiment(self, path: str):
        experiment = self.load(path, Experiment)
        suite, cases = self.suite(experiment.suite)
        targets = {v.name: self.load(v.target, TargetConfig) for v in experiment.variants}
        from execution.preflight import validate_experiment

        validate_experiment(self, experiment, cases, targets)
        return experiment, suite, cases, targets
