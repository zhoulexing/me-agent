"""Interpret YBA session records without inferring unsupported evidence."""

import json

from adapters.base import TargetError
from evidence.redaction import redact
from models import Completeness, Event, Evidence

KNOWN_ROLES = {"user", "assistant", "tool_use", "tool_result", "result", "usage", "task"}


def parse_records(text, day, run_id, thread_id, secrets=()):
    events = []
    if text is not None:
        if not isinstance(text, str):
            raise TargetError("message query data must be JSONL text")
        lines = text.splitlines()
        for index, line in enumerate(lines):
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
            except ValueError as exc:
                if index == len(lines) - 1 and not text.endswith("\n"):
                    break
                raise TargetError("malformed complete session record") from exc
            if not isinstance(raw, dict) or raw.get("claw_trace_id") != run_id:
                continue
            if raw.get("thread_id", "") != thread_id:
                continue
            role = raw.get("role", "other")
            events.append(
                Event(
                    event_id=f"{day}:{index}",
                    target_run_id=run_id,
                    source="yba_session_record",
                    kind=role if role in KNOWN_ROLES else "other",
                    payload=redact(raw, secrets),
                )
            )
    return events


def collect(run_id, events):
    finals = [
        e
        for e in events
        if e.kind == "result"
        and e.payload.get("done_type") == "query"
        and not e.payload.get("parent_tool_use_id")
    ]
    status = "running"
    if finals:
        final = finals[-1].payload
        reason = str(final.get("stop_reason") or final.get("terminal_reason") or "")
        if reason in {"interrupted", "aborted_streaming", "aborted_tools"}:
            status = "interrupted"
        elif (
            final.get("is_error")
            or str(final.get("subtype", "")).startswith("error")
            or final.get("code")
            or final.get("api_error_status")
            or reason == "error"
        ):
            status = "failed"
        else:
            status = "completed"
    return Evidence(
        target_run_id=run_id,
        status=status,
        events=events,
        completeness=Completeness(trace=bool(finals)),
        notes=[
            "Session records do not prove outbound delivery, business state or artifact contents.",
            "Known authentication values and structured credential fields were redacted before persistence.",
        ],
    )
