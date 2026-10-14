"""Use verified YBA notify and message-query APIs; do not invent export endpoints."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from adapters.base import TargetError
from adapters.yba.collector import collect, parse_records
from adapters.yba.transport import PodTransport
from models import EvalCase, SessionLease, TargetConfig, Turn

BEIJING = timezone(timedelta(hours=8))


class YbaTarget:
    def __init__(self, config: TargetConfig, lease: SessionLease, client: httpx.AsyncClient | None = None):
        self.config, self.lease = config, lease
        self.transport = PodTransport(config, client)
        self.secrets = self.transport.secrets
        self.starts: dict[str, datetime] = {}

    async def request(self, method: str, path: str, *, body=None, missing_ok=False):
        return await self.transport.request(method, path, body=body, missing_ok=missing_ok)

    async def describe(self):
        # The inspected API cannot report actual loaded prompt/skill hashes or safe cancellation.
        return {
            "kind": "yba",
            "synthetic": False,
            "pod_id": self.config.pod_id,
            "pod_environment": self.config.pod_environment,
            "pod_transport": self.config.pod_transport,
            "proxy_origin": self.config.base_url,
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
        await self.transport.close()
