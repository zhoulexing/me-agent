"""Exercise the source-only CLI and state compatibility after relocation."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from config import EvalConfig
from storage import Repository

PROJECT = Path(__file__).resolve().parents[1]


def test_source_cli_operations_from_another_directory(tmp_path):
    state = tmp_path / "state"
    env = dict(os.environ)
    env.pop("PYTHONPATH", None)

    def invoke(*arguments, expected=0):
        result = subprocess.run(
            [
                sys.executable,
                str(PROJECT / "src/cli.py"),
                "--project",
                str(PROJECT),
                "--state-dir",
                str(state),
                *arguments,
            ],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
            timeout=20,
        )
        assert result.returncode == expected, result.stderr
        return json.loads(result.stdout)

    assert invoke("validate", "datasets/selftest/suites/smoke.yaml")["cases"] == 5
    assert invoke("validate", "experiments/golden.yaml", "--experiment")["valid"]
    golden = invoke("run", "experiments/selftest-golden.yaml")
    broken = invoke("run", "experiments/broken.yaml", expected=1)
    assert golden["verdicts"] == ["pass"] * 10
    assert broken["verdicts"] == ["fail"] * 10
    assert Path(golden["report"]).is_file()
    comparison = invoke("compare", golden["experiment_id"], broken["experiment_id"])
    assert comparison["comparable"] and comparison["synthetic"]
    assert len(comparison["changes"]) == 10

    repo = Repository(state)
    trial = repo.results(golden["experiment_id"])[0]
    result_path = repo.trial_dir(trial.trial_id) / "result.json"
    original = result_path.read_bytes()
    assert invoke("inspect", trial.trial_id)["result"]["verdict"] == "pass"
    regrade = invoke("regrade", golden["experiment_id"])
    assert (state / "regrades" / f"{regrade['regrade_id']}.json").is_file()
    rerun = invoke("rerun", trial.trial_id)
    assert rerun["experiment_id"] != golden["experiment_id"]
    assert rerun["verdicts"] == ["pass"]
    assert Path(invoke("report", golden["experiment_id"])["report"]).is_file()
    assert not invoke("cancel", golden["experiment_id"])["cancel_requested"]
    assert result_path.read_bytes() == original


def test_default_state_preserves_legacy_session_leases(tmp_path, monkeypatch):
    monkeypatch.delenv("AGENT_EVALS_STATE_DIR", raising=False)
    monkeypatch.delenv("CLAW_EVALS_STATE_DIR", raising=False)
    assert EvalConfig(tmp_path).state_dir == tmp_path / ".agent-evals"
    legacy = Repository(tmp_path / ".claw-evals")
    experiment = legacy.create("existing", {})
    trial = legacy.add_trial(experiment, "existing", "baseline", 0)
    legacy.claim(trial, "used-session")
    # Even if a new directory was created, the existing permanent leases are retained.
    (tmp_path / ".agent-evals").mkdir()
    config = EvalConfig(tmp_path)
    assert config.state_dir == tmp_path / ".claw-evals"
    migrated = Repository(config.state_dir)
    next_trial = migrated.add_trial(experiment, "next", "baseline", 0)
    import sqlite3

    with pytest.raises(sqlite3.IntegrityError):
        migrated.claim(next_trial, "used-session")


def test_state_override_precedence(tmp_path, monkeypatch):
    old_override = tmp_path / "old-override"
    new_override = tmp_path / "new-override"
    explicit = tmp_path / "explicit"
    monkeypatch.delenv("AGENT_EVALS_STATE_DIR", raising=False)
    monkeypatch.setenv("CLAW_EVALS_STATE_DIR", str(old_override))
    assert EvalConfig(tmp_path).state_dir == old_override
    monkeypatch.setenv("AGENT_EVALS_STATE_DIR", str(new_override))
    assert EvalConfig(tmp_path).state_dir == new_override
    assert EvalConfig(tmp_path, explicit).state_dir == explicit
