"""Remote proxy, credential, and session-isolation contracts."""

import asyncio
import json
from datetime import datetime

import httpx
import pytest
from pydantic import ValidationError
from test_contracts import case, yba_config

from adapters.base import TargetError
from adapters.yba.adapter import BEIJING, YbaTarget
from adapters.yba.transport import auth_headers, proxy_path
from config import EvalConfig
from environments.prepared import lease_key
from execution.preflight import validate_experiment
from models import Experiment


@pytest.mark.parametrize("environment", ["qa", "pre", "prod"])
def test_admin_submit_and_poll_use_full_gateway_path(tmp_path, environment):
    async def run():
        requests = []
        cfg = yba_config(
            base_url=None,
            pod_environment=environment,
            pod_id=f"agent-pod-{environment}-youzan-business-assistant-test",
        )
        prefix = f"/api/agent-pod-proxy/api/v1/agent-pods/{cfg.pod_id}/proxy/8080"

        def handler(request):
            requests.append(request)
            assert request.url.host == f"claw-admin.{environment}.qima-inc.com"
            assert request.method == "POST"
            assert request.headers["Cookie"] == "session=test-cookie"
            assert request.headers["Referer"] == (
                f"https://claw-admin.{environment}.qima-inc.com/manage/project/youzan-business-assistant/pods"
            )
            body = json.loads(request.content)
            if request.url.path == prefix + "/api/messages/notify":
                assert body == {
                    "session_key": "feishu:test:test",
                    "thread_id": "",
                    "target": "agent",
                    "channel_mode": "all",
                    "model": "model-test",
                    "message": {"type": "text", "text": "hello"},
                }
                return httpx.Response(200, json={"success": True, "data": {"claw_trace_id": "trace"}})
            assert request.url.path == prefix + "/api/messages"
            assert body == {
                "date": datetime.now(BEIJING).date().isoformat(),
                "session_key": "feishu:test:test",
            }
            record = {
                "role": "result",
                "claw_trace_id": "trace",
                "done_type": "query",
                "content": "test-cookie",
            }
            return httpx.Response(200, json={"success": True, "data": json.dumps(record) + "\n"})

        target = YbaTarget(cfg, cfg.sessions[0], httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        try:
            run_id = await target.submit(case(), case().turns[0], 0, "trial-key", "model-test")
            evidence = await target.poll(run_id, tmp_path)
            assert evidence.status == "completed"
            assert "test-cookie" not in evidence.model_dump_json()
            assert len(requests) == 2
            description = await target.describe()
            assert description["pod_id"] == cfg.pod_id
            assert "test-cookie" not in json.dumps(description)
        finally:
            await target.close()

    asyncio.run(run())


def test_service_transport_matches_ade_proxy_and_api_key(tmp_path, monkeypatch):
    monkeypatch.setenv("YBA_TEST_API_KEY", "Bearer test-api-key")

    async def run():
        cfg = yba_config(
            base_url="http://agent-pod.qa.s.qima-inc.com",
            pod_transport="service",
            headers_env={"Authorization": "YBA_TEST_API_KEY"},
        )

        def handler(request):
            assert request.url.path == f"/api/v1/agent-pods/{cfg.pod_id}/proxy/8080/api/messages"
            assert request.headers["Authorization"] == "Bearer test-api-key"
            assert "Cookie" not in request.headers
            return httpx.Response(200, json={"success": True, "data": ""})

        target = YbaTarget(cfg, cfg.sessions[0], httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        try:
            target.starts["trace"] = datetime.now(BEIJING)
            assert (await target.poll("trace", tmp_path)).status == "running"
        finally:
            await target.close()

    asyncio.run(run())


@pytest.mark.parametrize("status", [302, 401, 403])
def test_authentication_failure_never_redirects_or_resubmits(status):
    async def run():
        requests = []

        def handler(request):
            requests.append(request)
            return httpx.Response(status, headers={"Location": "https://unexpected.example/login"})

        cfg = yba_config()
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
        target = YbaTarget(cfg, cfg.sessions[0], client)
        try:
            with pytest.raises(TargetError, match="authentication failed"):
                await target.submit(case(), case().turns[0], 0, "key", "")
            assert len(requests) == 1
        finally:
            await target.close()

    asyncio.run(run())


def test_notify_transport_timeout_is_not_retried():
    async def run():
        requests = []

        def handler(request):
            requests.append(request)
            raise httpx.ReadTimeout("private response detail", request=request)

        cfg = yba_config()
        target = YbaTarget(cfg, cfg.sessions[0], httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        try:
            with pytest.raises(TargetError, match="submission is not retried") as failure:
                await target.submit(case(), case().turns[0], 0, "key", "")
            assert "private response detail" not in str(failure.value)
            assert len(requests) == 1
        finally:
            await target.close()

    asyncio.run(run())


def test_cached_helper_cookie_is_read_without_being_stored_in_config(tmp_path):
    cookie = tmp_path / "pod-cookie"
    cookie.write_text("session=cached-cookie; other=second-secret\n")
    cfg = yba_config(headers_env={}, cookie_file=str(cookie))
    headers, secrets = auth_headers(cfg)
    assert headers["cookie"] == "session=cached-cookie; other=second-secret"
    assert "cached-cookie" in secrets and "second-secret" in secrets
    assert "cached-cookie" not in cfg.model_dump_json()
    cookie.unlink()
    with pytest.raises(TargetError, match="cannot read configured Pod Cookie file"):
        auth_headers(cfg)


def test_missing_cookie_fails_before_any_request():
    with pytest.raises(TargetError, match="requires Cookie"):
        YbaTarget(yba_config(headers_env={}), yba_config().sessions[0])


@pytest.mark.parametrize(
    "base_url",
    ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080", "http://0.0.0.0:8080"],
)
def test_local_yba_is_rejected(base_url):
    with pytest.raises(ValidationError, match="remote Pod proxy"):
        yba_config(base_url=base_url)


def test_pod_environment_and_admin_host_must_match():
    with pytest.raises(ValidationError, match="matching pod_environment"):
        yba_config(pod_id="agent-pod-prod-youzan-business-assistant-test")
    with pytest.raises(ValidationError, match="matching HTTPS"):
        yba_config(base_url="https://claw-admin.prod.qima-inc.com")


def test_same_session_on_different_pods_has_distinct_leases(tmp_path):
    first = yba_config()
    other_pod = yba_config(pod_id="agent-pod-qa-youzan-business-assistant-other")
    same_pod_service = yba_config(base_url="http://agent-pod.qa.s.qima-inc.com", pod_transport="service")
    assert lease_key(first, 0) != lease_key(other_pod, 0)
    assert lease_key(first, 0) == lease_key(same_pod_service, 0)
    config = EvalConfig(tmp_path)
    experiment = Experiment(name="leases", suite="unused", variants=[{"name": "one", "target": "unused"}])
    validate_experiment(config, experiment, [case()], {"one": first, "two": other_pod})
    with pytest.raises(ValueError, match="share target session leases"):
        validate_experiment(config, experiment, [case()], {"one": first, "two": same_pod_service})


def test_proxy_does_not_accept_path_escape():
    with pytest.raises(TargetError, match="invalid Pod service path"):
        proxy_path(yba_config(), "/api/../other")
