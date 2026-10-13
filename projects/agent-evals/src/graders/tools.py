"""Tools evidence checks."""

from fnmatch import fnmatchcase
from functools import partial

from graders.base import result as make_result


def check(spec, turns, artifact_root):
    result = partial(make_result, spec)
    events = [e for t in turns for e in t.events]
    selected = [e for e in events if e.kind == "tool_use"]
    names = {str(e.payload.get("name") or e.payload.get("tool_name") or "") for e in selected}
    wanted = spec.params["names"]
    matched = [any(fnmatchcase(name, pattern) for name in names) for pattern in wanted]
    violated = any(matched) if spec.id == "tools.forbidden" else False
    if violated:
        return result("fail", "forbidden tool observed", [e.event_id for e in selected])
    if not all(t.completeness.trace for t in turns):
        return result("unknown", "cannot verify tool constraints on incomplete trace")
    valid = all(matched) if spec.id == "tools.required" else True
    return result("pass" if valid else "fail", "tool constraint check", [e.event_id for e in selected])
