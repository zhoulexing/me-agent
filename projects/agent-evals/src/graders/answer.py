"""Answer evidence checks."""

from functools import partial

from graders.base import result as make_result


def check(spec, turns, artifact_root):
    result = partial(make_result, spec)
    final = turns[-1]
    source = spec.params.get("source", "outbound")
    complete = final.completeness.outbound if source == "outbound" else final.completeness.trace
    if not complete:
        return result("unknown", f"{source} evidence is incomplete")
    selected = [e for e in final.events if e.kind == source and not e.payload.get("parent_tool_use_id")]
    text = "\n".join(str(e.payload.get("content", "")) for e in selected)
    valid = bool(text.strip())
    if spec.id == "answer.contains":
        valid = valid and all(s in text for s in spec.params.get("all", []))
        valid = valid and all(s not in text for s in spec.params.get("none", []))
    return result("pass" if valid else "fail", f"{source} answer check", [e.event_id for e in selected])
