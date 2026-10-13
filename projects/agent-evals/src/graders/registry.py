"""Only registered graders are executable; YAML cannot run arbitrary code."""

from pathlib import Path

from graders import answer, artifacts, completion, state, tools
from graders.base import result
from models import Evidence, GraderSpec

PARAMS = {
    "runtime.completed": set(),
    "answer.nonempty": {"source"},
    "answer.contains": {"source", "all", "none"},
    "tools.forbidden": {"names"},
    "tools.required": {"names"},
    "state.equals": {"path", "value"},
    "artifact.csv": {"name", "columns", "rows"},
}


def validate_grader(spec: GraderSpec):
    if spec.id not in PARAMS:
        raise ValueError(f"unregistered grader: {spec.id}")
    if set(spec.params) - PARAMS[spec.id]:
        raise ValueError(f"unknown parameters for {spec.id}")
    p = spec.params
    if spec.id.startswith("answer.") and p.get("source", "outbound") not in {"outbound", "assistant"}:
        raise ValueError("answer source must be outbound or assistant")
    if spec.id == "state.equals" and (
        not isinstance(p.get("path"), str) or not p["path"] or "value" not in p
    ):
        raise ValueError("state.equals requires path and value")
    if spec.id.startswith("tools.") and (not isinstance(p.get("names"), list) or not p["names"]):
        raise ValueError("tool graders require nonempty names")
    if spec.id == "answer.contains" and not (p.get("all") or p.get("none")):
        raise ValueError("answer.contains requires all or none")
    for key in ("all", "none", "names", "columns"):
        if key in p and (not isinstance(p[key], list) or not all(isinstance(v, str) for v in p[key])):
            raise ValueError(f"{key} must be a string list")
    if spec.id == "artifact.csv":
        if not isinstance(p.get("name"), str) or not isinstance(p.get("columns"), list) or not p["columns"]:
            raise ValueError("artifact.csv requires name and columns")
        if not isinstance(p.get("rows"), list) or not all(isinstance(row, dict) for row in p["rows"]):
            raise ValueError("artifact.csv requires expected rows")


CHECKS = {
    "runtime.completed": completion.check,
    "answer.nonempty": answer.check,
    "answer.contains": answer.check,
    "tools.required": tools.check,
    "tools.forbidden": tools.check,
    "state.equals": state.check,
    "artifact.csv": artifacts.check,
}


def check(spec: GraderSpec, turns: list[Evidence], artifact_root: Path):
    if not turns:
        return result(spec, "unknown", "no evidence")
    return CHECKS[spec.id](spec, turns, artifact_root)
