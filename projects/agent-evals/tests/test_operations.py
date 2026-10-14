import asyncio
import hashlib
import json
import shutil
from datetime import datetime, timedelta

import httpx
import pytest
from test_contracts import PROJECT, case, evidence, yba_config

from adapters.base import TargetError
from adapters.yba.adapter import BEIJING, YbaTarget
from cli import main
from config import EvalConfig
from evidence.redaction import redact
from execution.runner import run_experiment
from execution.worker import execute
from graders import evaluate, grade
from models import Artifact, Event, TrialResult
from service import rerun
from storage import Repository


def test_rerun_uses_frozen_case_and_fixture(tmp_path):
    project = tmp_path / "project"
    for directory in ("datasets", "configs", "experiments"):
        shutil.copytree(PROJECT / directory, project / directory)
    config = EvalConfig(project, tmp_path / "state")
    original = asyncio.run(run_experiment(config, "experiments/selftest-golden.yaml"))
    repo = Repository(config.state_dir)
    trial = repo.results(original)[0]
    source_result = (repo.trial_dir(trial.trial_id) / "result.json").read_bytes()
    (project / "datasets/selftest/cases/greeting.yaml").write_text("invalid: definition")
    (project / "datasets/selftest/fixtures/golden/greeting.json").write_text("invalid JSON")
    repeated = asyncio.run(rerun(config, trial.trial_id))
    assert repeated != original
    assert len(repo.results(repeated)) == 1
    assert repo.results(repeated)[0].verdict == "pass"
    assert repo.get(repeated)["manifest"]["lineage"]["source_trial_id"] == trial.trial_id
    assert (repo.trial_dir(trial.trial_id) / "result.json").read_bytes() == source_result
    frozen = config.state_dir / "experiments" / original / "fixtures" / "golden" / "greeting.json"
    frozen.write_text("tampered")
    with pytest.raises(ValueError, match="snapshot was modified"):
        asyncio.run(rerun(config, trial.trial_id))


def test_cli_live_requires_explicit_opt_in_and_yaml_errors_are_safe(tmp_path, capsys):
    (tmp_path / "case.yaml").write_text(
        "case_id: test\ndescription: test\nturns: [{user: hello}]\ngraders: [{id: runtime.completed}]\n"
    )
    (tmp_path / "suite.yaml").write_text("name: live\npurpose: integration\ncases: [case.yaml]\n")
    # JSON is a YAML subset; no network mock is needed: refusal precedes target construction.
    (tmp_path / "target.yaml").write_text(json.dumps(yba_config().model_dump()))
    (tmp_path / "exp.yaml").write_text(
        "name: live\nsuite: suite.yaml\nvariants: [{name: live, target: target.yaml}]\n"
    )
    assert main(["--project", str(tmp_path), "run", "exp.yaml"]) == 2
    assert "--live" in capsys.readouterr().err
    assert not (tmp_path / ".agent-evals").exists()
    (tmp_path / "exp.yaml").write_text("secret: [do-not-print")
    assert main(["--project", str(tmp_path), "validate", "exp.yaml", "--experiment"]) == 2
    assert "do-not-print" not in capsys.readouterr().err


def test_mcp_tool_names_match_only_explicit_patterns(tmp_path):
    ev = evidence(events=[Event(event_id="t", kind="tool_use", payload={"name": "mcp__tools__delete"})])
    assert (
        grade(case({"id": "tools.forbidden", "params": {"names": ["mcp__*__delete"]}}), [ev], tmp_path)[1]
        == "fail"
    )
    assert grade(case({"id": "tools.required", "params": {"names": ["delete"]}}), [ev], tmp_path)[1] == "fail"


def test_artifact_hash_and_contents_are_separate_checks(tmp_path):
    path = tmp_path / "0" / "data.csv"
    path.parent.mkdir()
    path.write_text("item,count\napple,999\n")
    ev = evidence(
        artifacts=[
            Artifact(
                name="data.csv",
                path="data.csv",
                size=path.stat().st_size,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
        ]
    )
    ev.completeness.artifacts = True
    c = case(
        {
            "id": "artifact.csv",
            "params": {
                "name": "data.csv",
                "columns": ["item", "count"],
                "rows": [{"item": "apple", "count": "2"}],
            },
        }
    )
    assert grade(c, [ev], tmp_path)[1] == "fail"  # Export succeeded, business data is wrong.
    path.write_text("item,count\napple,2\n")
    assert grade(c, [ev], tmp_path)[1] == "unknown"  # Evidence changed after collection.


def test_regrade_keeps_execution_budget_unknown(tmp_path):
    _, verdict, _ = evaluate(case(limits={"max_input_tokens": 100}), [evidence()], tmp_path, "finished", "")
    assert verdict == "unknown"
    assert evaluate(case(), [evidence()], tmp_path, "timeout", "undetermined")[1] == "unknown"


def test_cancel_before_execution_does_not_submit(tmp_path):
    class UnusedTarget:
        async def submit(self, *args):
            pytest.fail("cancelled trial submitted")

        async def close(self):
            pass

    repo = Repository(tmp_path)
    exp = repo.create("test", {})
    trial = repo.add_trial(exp, "test", "v", 0)
    repo.cancel(exp)
    result = asyncio.run(
        execute(
            target=UnusedTarget(),
            target_config=yba_config(),
            case=case(),
            variant="v",
            model="",
            repetition=0,
            trial_id=trial,
            experiment_id=exp,
            repo=repo,
        )
    )
    assert result.execution_status == "cancelled" and result.cleanup == "not_needed"


@pytest.mark.parametrize(
    "terminal,expected",
    [
        ({"is_error": True}, "failed"),
        ({"subtype": "error_during_execution"}, "failed"),
        ({"stop_reason": "error"}, "failed"),
        ({"api_error_status": 429}, "failed"),
        ({"terminal_reason": "aborted_tools"}, "interrupted"),
    ],
)
def test_yba_terminal_error_fields(tmp_path, terminal, expected):
    async def run():
        record = {"role": "result", "done_type": "query", "claw_trace_id": "trace", **terminal}
        client = httpx.AsyncClient(
            base_url="http://test",
            transport=httpx.MockTransport(
                lambda r: httpx.Response(200, json={"success": True, "data": json.dumps(record) + "\n"})
            ),
        )
        cfg = yba_config()
        target = YbaTarget(cfg, cfg.sessions[0], client)
        target.starts["trace"] = datetime.now(BEIJING)
        assert (await target.poll("trace", tmp_path)).status == expected
        await target.close()

    asyncio.run(run())


def test_cross_midnight_read_and_partial_record(tmp_path):
    async def run():
        dates = []

        def handler(request):
            dates.append(json.loads(request.content)["date"])
            return httpx.Response(200, json={"success": True, "data": '{"role":'})

        cfg = yba_config()
        target = YbaTarget(
            cfg,
            cfg.sessions[0],
            httpx.AsyncClient(base_url="http://test", transport=httpx.MockTransport(handler)),
        )
        target.starts["trace"] = datetime.now(BEIJING) - timedelta(days=1)
        assert (await target.poll("trace", tmp_path)).status == "running"
        assert len(dates) == 2
        await target.close()

    asyncio.run(run())


def test_complete_malformed_record_is_protocol_error(tmp_path):
    async def run():
        cfg = yba_config()
        target = YbaTarget(
            cfg,
            cfg.sessions[0],
            httpx.AsyncClient(
                base_url="http://test",
                transport=httpx.MockTransport(
                    lambda r: httpx.Response(200, json={"success": True, "data": '{"role":\n'})
                ),
            ),
        )
        target.starts["trace"] = datetime.now(BEIJING)
        with pytest.raises(TargetError, match="malformed complete"):
            await target.poll("trace", tmp_path)
        await target.close()

    asyncio.run(run())


def test_credentials_are_redacted_before_evidence():
    value = {"input": {"password": "hidden"}, "content": "Bearer known-secret", "api_key": "hidden"}
    sanitized = redact(value, ["known-secret"])
    assert sanitized["input"]["password"] == "[REDACTED]"
    assert "hidden" not in json.dumps(sanitized)
    assert "known-secret" not in json.dumps(sanitized)


def test_legacy_direct_yba_manifest_reruns_with_new_pod_config(tmp_path, monkeypatch):
    import service

    config = EvalConfig(tmp_path, tmp_path / "state")
    repo = Repository(config.state_dir)
    original_case = case()
    manifest = {
        "cases": [original_case.model_dump()],
        "experiment": {
            "suite": "historical-suite.yaml",
            "variants": [{"name": "baseline", "target": "old-target.yaml", "model": "old-model"}],
        },
        "suite": {"purpose": "integration"},
        "targets": {"baseline": {"kind": "yba", "base_url": "http://127.0.0.1:8080"}},
    }
    experiment = repo.create("historical-yba", manifest)
    trial = repo.add_trial(experiment, original_case.case_id, "baseline", 0)
    repo.finish_trial(
        TrialResult(
            trial_id=trial,
            case_id=original_case.case_id,
            variant="baseline",
            repetition=0,
            mode="yba",
            execution_status="finished",
            verdict="unknown",
        )
    )
    (tmp_path / "remote.yaml").write_text(json.dumps(yba_config().model_dump()))

    async def capture(config, experiment, suite, cases, targets, progress, **kwargs):
        assert cases[0] == original_case
        assert experiment.variants[0].model == "old-model"
        assert targets["baseline"].pod_id == "agent-pod-qa-youzan-business-assistant-test"
        assert kwargs["lineage"]["source_trial_id"] == trial
        return "new-experiment"

    monkeypatch.setattr(service, "run_definition", capture)
    assert asyncio.run(rerun(config, trial, target_path="remote.yaml", live=True)) == "new-experiment"
    with pytest.raises(ValueError, match="requires --live and --target"):
        asyncio.run(rerun(config, trial))
