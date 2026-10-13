"""Completion evidence checks."""

from functools import partial

from graders.base import result as make_result


def check(spec, turns, artifact_root):
    result = partial(make_result, spec)
    if any(t.status in {"failed", "interrupted"} for t in turns):
        return result("fail", "target failed or was interrupted")
    if not all(t.status == "completed" and t.completeness.trace for t in turns):
        return result("unknown", "final query boundary or complete trace is missing")
    return result("pass", "all submitted turns reached their final query boundary")
