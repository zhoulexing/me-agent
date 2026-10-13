"""Use verified YBA notify and message-query APIs; do not invent export endpoints."""

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from adapters.base import TargetError
from adapters.yba.collector import collect, parse_records
from models import EvalCase, SessionLease, TargetConfig, Turn

BEIJING = timezone(timedelta(hours=8))


class YbaTarget:
    def __init__(self, config: TargetConfig, lease: SessionLease, client: httpx.AsyncClient | None = None):
        self.config, self.lease = config, lease
        headers = {}
        self.secrets = []
        for header, variable in config.headers_env.items():
            value = os.environ.get(variable)
            if not value:
                raise TargetError(f"missing header environment variable: {variable}")
            headers[header] = value
            self.secrets.append(value)
            if value.startswith(("Bearer ", "Basic ")):
                self.secrets.append(value.split(" ", 1)[1])
        self.client = client or httpx.AsyncClient(
            base_url=config.base_url.rstrip("/"),
            headers=headers,
            timeout=config.request_timeout_seconds,
            follow_redirects=False,
            trust_env=False,
        )
        self.starts: dict[str, datetime] = {}

    async def request(self, method: str, path: str, *, body=None, missing_ok=False):
        # Streaming bounds apply before JSON parsing. Mutating POSTs are never retried.
        try:
            async with self.client.stream(method, path, json=body) as response:
                if missing_ok and response.status_code == 404:
                    return None
                if not 200 <= response.status_code < 300:
                    raise TargetError(f"YBA {path}: HTTP {response.status_code}")
                chunks = bytearray()
                async for chunk in response.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > self.config.max_response_bytes:
                        raise TargetError("YBA response exceeds configured byte budget")
                try:
                    value = json.loads(chunks)
                except (ValueError, UnicodeError) as exc:
                    raise TargetError("YBA response is not valid JSON") from exc
        except httpx.HTTPError as exc:
            raise TargetError(
                f"YBA transport error: {type(exc).__name__}; submission is not retried"
            ) from exc
        if not isinstance(value, dict) or value.get("success") is not True:
            raise TargetError("YBA response envelope is not successful")
        return value.get("data")

    async def describe(self):
        # The inspected API cannot report actual loaded prompt/skill hashes or safe cancellation.
        return {
            "kind": "yba",
            "synthetic": False,
            "revision_source": "configuration_unverified",
            "declared_revision": self.config.declared_revision,
            "environment_revision": self.config.environment_revision,
            "capabilities": ["notify", "session_records", "trace_filter", "query_final_if_supported"],
            "missing": [
                "actual_definition_snapshot",
                "outbound_receipt",
                "state_export",
                "artifact_export",
                "cancel",
            ],
            "input_source": "background",  # notify does not reproduce normal inbound/busy-buffer behavior
        }

    async def submit(self, case: EvalCase, turn: Turn, index: int, key: str, model: str):
        started = datetime.now(BEIJING)
        body = {
            **self.lease.model_dump(),
            "target": "agent",
            "channel_mode": "all",
            "message": {"type": "text", "text": turn.user},
        }
        if model:
            body["model"] = model
        data = await self.request("POST", "/api/messages/notify", body=body)
        trace = data.get("claw_trace_id") if isinstance(data, dict) else None
        if not isinstance(trace, str) or not trace.strip():
            raise TargetError(
                "notify accepted without claw_trace_id; execution may have started, do not resubmit"
            )
        self.starts[trace] = started
        return trace

    async def poll(self, run_id: str, artifact_dir: Path):
        start, now = self.starts[run_id], datetime.now(BEIJING)
        events = []
        day = start.date()
        while day <= now.date():
            text = await self.request(
                "POST",
                "/api/messages",
                body={
                    "date": day.isoformat(),
                    "session_key": self.lease.session_key,
                },
                missing_ok=True,
            )
            events.extend(parse_records(text, day, run_id, self.lease.thread_id, self.secrets))
            day += timedelta(days=1)
        return collect(run_id, events)

    async def cancel(self, run_id: str):
        return "unsupported: target execution may still be running; retire its test session"

    async def close(self):
        await self.client.aclose()
