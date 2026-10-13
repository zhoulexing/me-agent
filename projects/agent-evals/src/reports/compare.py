"""Compare frozen experiments and explain comparability limits."""

from reports.summary import summarize
from storage import Repository


def compare(repo: Repository, baseline_id: str, candidate_id: str):
    baseline, candidate = repo.get(baseline_id), repo.get(candidate_id)
    reasons = []
    if baseline["status"] != "finished" or candidate["status"] != "finished":
        reasons.append("experiment is not finished")
    for key in ("suite_fingerprint", "grading_version"):
        if baseline["manifest"][key] != candidate["manifest"][key]:
            reasons.append(f"different {key}")
    if (
        baseline["manifest"]["experiment"]["repetitions"]
        != candidate["manifest"]["experiment"]["repetitions"]
    ):
        reasons.append("different repetition counts")
    a, b = repo.results(baseline_id), repo.results(candidate_id)
    if len({r.variant for r in a}) != 1 or len({r.variant for r in b}) != 1:
        raise ValueError("cross-experiment comparison requires one variant per experiment")
    left = {(r.case_id, r.repetition): r for r in a}
    right = {(r.case_id, r.repetition): r for r in b}
    if left.keys() != right.keys():
        reasons.append("different completed trial sets")
    if {r.mode for r in a} != {r.mode for r in b}:
        reasons.append("different execution modes")
    if any(r.mode == "yba" for r in [*a, *b]):
        reasons.append("YBA actual environment/prompt/skill snapshots are not verified by current API")
    changes = [
        {"case_id": key[0], "repetition": key[1], "before": left[key].verdict, "after": right[key].verdict}
        for key in sorted(left.keys() & right.keys())
    ]
    return {
        "baseline": baseline_id,
        "candidate": candidate_id,
        "comparable": not reasons,
        "reasons": reasons,
        "synthetic": any(r.mode == "fixture" for r in [*a, *b]),
        "changes": changes,
        "baseline_summary": summarize(a),
        "candidate_summary": summarize(b),
    }
