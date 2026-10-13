"""Existing required-grade, execution and budget verdict policy."""

from pathlib import Path

from graders.registry import check, validate_grader
from models import EvalCase, Evidence, Grade


def grade(case: EvalCase, turns: list[Evidence], artifact_root: Path) -> tuple[list[Grade], str]:
    grades = []
    for spec in case.graders:
        validate_grader(spec)
        try:
            grades.append(check(spec, turns, artifact_root))
        except (OSError, ValueError, TypeError, KeyError) as exc:
            grades.append(
                Grade(
                    grader_id=spec.id,
                    required=spec.required,
                    verdict="unknown",
                    reason=f"grader evidence error: {type(exc).__name__}",
                )
            )
    if len(turns) != len(case.turns):
        grades.append(
            Grade(
                grader_id="conversation.complete",
                required=True,
                verdict="unknown",
                reason="not all scripted user turns ran",
            )
        )
    required = [g.verdict for g in grades if g.required]
    verdict = "fail" if "fail" in required else "pass" if all(v == "pass" for v in required) else "unknown"
    return grades, verdict


def evaluate(case, turns, artifact_root, execution_status, attribution):
    """Shared original/regrade policy: evidence cannot erase execution or budget limits."""
    from evidence.usage import metrics

    grades, verdict = grade(case, turns, artifact_root)
    measured = metrics(turns)
    if execution_status != "finished":
        verdict = "fail" if attribution == "agent" else "unknown"
    if case.limits.max_input_tokens and measured["total_input_tokens"] is None:
        grades.append(
            Grade(
                grader_id="budget.input_tokens",
                required=True,
                verdict="unknown",
                reason="usage coverage cannot verify configured input budget",
            )
        )
        if verdict == "pass":
            verdict = "unknown"
    return grades, verdict, measured
