import asyncio
import hashlib
import json
from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError

from adapters.base import TargetError
from adapters.yba.adapter import YbaTarget
from config import EvalConfig, inside
from evidence.usage import metrics
from execution.runner import run_experiment
from execution.worker import execute
from graders import grade
from models import EvalCase, Event, Evidence, SessionLease, TargetConfig
from reports import compare
from service import regrade
from storage import Repository

PROJECT = Path(__file__).resolve().parents[1]


def case(*graders, turns=1, limits=None):
    return EvalCase.model_validate(
        {
            "case_id": "test",
            "description": "test",
            "turns": [{"user": "hello"}] * turns,
            "graders": [{"id": "runtime.completed"}, *graders],
            "limits": limits or {},
        }
    )


def evidence(status="completed", complete=True, events=None, **kwargs):
    return Evidence(
        target_run_id="trace", status=status, events=events or [], completeness={"trace": complete}, **kwargs
    )


def yba_config(**kwargs):
    return TargetConfig(
        kind="yba",
        base_url="http://test",
        isolated_test_environment=True,
        declared_revision="test-sha",
        environment_revision="fixture-v1",
        sessions=[SessionLease(session_key="feishu:test:test")],
        **kwargs,
    )


def test_independent_imports_and_project_paths():
    import ast

    for path in (PROJECT / "src").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            names = [a.name for a in node.names] if isinstance(node, ast.Import) else []
            if isinstance(node, ast.ImportFrom):
                names.append(node.module or "")
            assert all(n != "app" and not n.startswith("app.") for n in names)
    with pytest.raises(ValueError):
        inside(PROJECT, "../app/config.py")


def test_reject_path_symlink_escape(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    (root / "outside").symlink_to(tmp_path)
    with pytest.raises(ValueError):
        inside(root, "outside/secrets")


def test_target_requires_isolation_and_distinct_workspaces():
    with pytest.raises(ValidationError):
        TargetConfig(kind="yba", base_url="http://test")
    with pytest.raises(ValidationError):
        yba_config().model_validate(
            {
                **yba_config().model_dump(),
                "sessions": [
                    {"session_key": "same", "thread_id": "one"},
                    {"session_key": "same", "thread_id": "two"},
                ],
            }
        )


@pytest.mark.parametrize(
    "status,complete,expected",
    [
        ("running", False, "unknown"),
        ("completed", False, "unknown"),
        ("completed", True, "pass"),
        ("failed", True, "fail"),
        ("interrupted", True, "fail"),
    ],
)
def test_completion_is_not_just_http_or_tool_success(tmp_path, status, complete, expected):
    _, verdict = grade(case(), [evidence(status, complete)], tmp_path)
    assert verdict == expected


def test_missing_outbound_and_state_never_pass(tmp_path):
    c = case({"id": "answer.nonempty"}, {"id": "state.equals", "params": {"path": "created", "value": True}})
    ev = evidence(events=[Event(event_id="a", kind="assistant", payload={"content": "Done!"})])
    grades, verdict = grade(c, [ev], tmp_path)
    assert verdict == "unknown"
    assert [g.verdict for g in grades] == ["pass", "unknown", "unknown"]


def test_required_failure_cannot_be_offset_by_other_success(tmp_path):
    c = case({"id": "tools.forbidden", "params": {"names": ["delete"]}})
    ev = evidence(events=[Event(event_id="bad", kind="tool_use", payload={"name": "delete"})])
    assert grade(c, [ev], tmp_path)[1] == "fail"


def test_scripted_turns_must_all_execute(tmp_path):
    assert grade(case(turns=2), [evidence()], tmp_path)[1] == "unknown"


def test_usage_does_not_add_stream_and_result_or_nested_totals():
    usage = {
        "input_tokens": 100,
        "output_tokens": 20,
        "cache_read_input_tokens": 50,
        "cache_creation_input_tokens": 0,
    }
    ev = evidence(
        events=[
            Event(event_id="u", kind="usage", payload={"usage": usage}),
            Event(event_id="r", kind="result", payload={"usage": usage}),
            Event(event_id="child", kind="result", payload={"usage": usage, "parent_tool_use_id": "child"}),
        ]
    )
    assert metrics([ev])["input_tokens"] == 100
    assert metrics([ev])["total_input_tokens"] == 150
    ev.events.append(Event(event_id="retry", kind="result", payload={"usage": usage}))
    assert metrics([ev])["input_tokens"] is None


def test_yba_waits_task_then_query_and_filters_other_traces(tmp_path):
    async def run():
        polls = 0
        requests = []

        def handler(request):
            nonlocal polls
            data = json.loads(request.content)
            requests.append((request.url.path, data))
            if request.url.path.endswith("notify"):
                assert data["channel_mode"] == "all"
                assert "idempotency_key" not in data  # not supported by actual API
                return httpx.Response(200, json={"success": True, "data": {"claw_trace_id": "trace"}})
            polls += 1
            records = [
                {"role": "result", "claw_trace_id": "other", "done_type": "query"},
                {"role": "result", "claw_trace_id": "trace", "done_type": "task"},
            ]
            if polls > 1:
                records.append({"role": "result", "claw_trace_id": "trace", "done_type": "query"})
            return httpx.Response(
                200, json={"success": True, "data": "\n".join(json.dumps(r) for r in records) + "\n"}
            )

        client = httpx.AsyncClient(base_url="http://test", transport=httpx.MockTransport(handler))
        cfg = yba_config()
        target = YbaTarget(cfg, cfg.sessions[0], client)
        run_id = await target.submit(case(), case().turns[0], 0, "key", "model-test")
        first = await target.poll(run_id, tmp_path)
        assert first.status == "running" and not first.completeness.trace
        final = await target.poll(run_id, tmp_path)
        assert final.status == "completed" and final.completeness.trace
        assert not final.completeness.outbound
        assert len(final.events) == 2
        assert all("command" not in body for _, body in requests)
        await target.close()

    asyncio.run(run())


def test_notify_missing_trace_never_retries():
    async def run():
        count = 0

        def handler(request):
            nonlocal count
            count += 1
            return httpx.Response(200, json={"success": True, "data": {"channel": "feishu"}})

        cfg = yba_config()
        target = YbaTarget(
            cfg,
            cfg.sessions[0],
            httpx.AsyncClient(base_url="http://test", transport=httpx.MockTransport(handler)),
        )
        with pytest.raises(TargetError, match="do not resubmit"):
            await target.submit(case(), case().turns[0], 0, "key", "")
        assert count == 1
        await target.close()

    asyncio.run(run())


def test_yba_response_budget():
    async def run():
        cfg = yba_config(max_response_bytes=1024)
        target = YbaTarget(
            cfg,
            cfg.sessions[0],
            httpx.AsyncClient(
                base_url="http://test",
                transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * 2048)),
            ),
        )
        with pytest.raises(TargetError, match="byte budget"):
            await target.submit(case(), case().turns[0], 0, "key", "")
        await target.close()

    asyncio.run(run())


def test_timeout_retains_trace_and_reports_unconfirmed_cancellation(tmp_path):
    class SlowTarget:
        async def submit(self, *args):
            return "trace"

        async def poll(self, *args):
            return evidence("running", False)

        async def cancel(self, *args):
            return "unsupported"

        async def close(self):
            pass

    repo = Repository(tmp_path)
    exp = repo.create("test", {})
    tid = repo.add_trial(exp, "test", "v", 0)
    result = asyncio.run(
        execute(
            target=SlowTarget(),
            target_config=TargetConfig(kind="fixture", fixtures=".", poll_seconds=0.01),
            case=case(limits={"timeout_seconds": 0.03}),
            variant="v",
            model="",
            repetition=0,
            trial_id=tid,
            experiment_id=exp,
            repo=repo,
        )
    )
    assert result.execution_status == "timeout" and result.verdict == "unknown"
    assert result.turns[0].target_run_id == "trace" and result.cleanup == "unsupported"
    assert (repo.trial_dir(tid) / "checkpoint.json").is_file()


def test_persistent_lease_prevents_reusing_test_session(tmp_path):
    import sqlite3

    repo = Repository(tmp_path)
    exp = repo.create("test", {})
    a = repo.add_trial(exp, "a", "v", 0)
    b = repo.add_trial(exp, "b", "v", 0)
    repo.claim(a, "session")
    with pytest.raises(sqlite3.IntegrityError):
        repo.claim(b, "session")
    assert repo.inspect(b)["status"] == "queued"


def test_five_cases_positive_negative_reports_and_immutable_regrade(tmp_path):
    cfg = EvalConfig(PROJECT, tmp_path)
    golden = asyncio.run(run_experiment(cfg, "experiments/selftest-golden.yaml"))
    broken = asyncio.run(run_experiment(cfg, "experiments/selftest-broken.yaml"))
    repo = Repository(tmp_path)
    assert len(repo.results(golden)) == 10
    assert {r.verdict for r in repo.results(golden)} == {"pass"}
    assert {r.verdict for r in repo.results(broken)} == {"fail"}
    comparison = compare(repo, golden, broken)
    assert comparison["synthetic"] is True
    assert all(c["before"] == "pass" and c["after"] == "fail" for c in comparison["changes"])
    path = repo.trial_dir(repo.results(golden)[0].trial_id) / "result.json"
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    regrade(cfg, golden)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    report = (tmp_path / "experiments" / golden / "report.html").read_text()
    assert "不能作为 Agent 效果结论" in report
    assert "Content-Security-Policy" in report
