"""Artifacts evidence checks."""

import csv
import hashlib
from functools import partial

from config import inside
from graders.base import result as make_result


def check(spec, turns, artifact_root):
    result = partial(make_result, spec)
    final = turns[-1]
    if not final.completeness.artifacts:
        return result("unknown", "artifact export is incomplete")
    matches = [a for a in final.artifacts if a.name == spec.params["name"]]
    if len(matches) != 1:
        return result("fail", "expected artifact is missing or ambiguous")
    artifact = matches[0]
    path = inside(artifact_root / str(len(turns) - 1), artifact.path)
    if not path.is_file() or path.stat().st_size != artifact.size:
        return result("unknown", "artifact evidence is missing or damaged")
    if hashlib.sha256(path.read_bytes()).hexdigest() != artifact.sha256:
        return result("unknown", "artifact checksum mismatch")
    try:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            rows = list(reader)
            valid = reader.fieldnames == spec.params["columns"] and rows == spec.params["rows"]
    except (UnicodeError, csv.Error):
        return result("fail", "artifact is not valid UTF-8 CSV")
    return result("pass" if valid else "fail", "CSV columns and values checked", [artifact.sha256])
