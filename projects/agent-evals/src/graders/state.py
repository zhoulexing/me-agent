"""State evidence checks."""

from functools import partial

from graders.base import result as make_result


def check(spec, turns, artifact_root):
    result = partial(make_result, spec)
    final = turns[-1]
    if not final.completeness.state:
        return result("unknown", "business state snapshot is missing")
    value = final.state
    for key in spec.params["path"].split("."):
        if not isinstance(value, dict) or key not in value:
            return result("fail", "expected business state field is absent")
        value = value[key]
    return result("pass" if value == spec.params["value"] else "fail", "business state comparison")
