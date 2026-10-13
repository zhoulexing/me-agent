"""Shared deterministic grader result construction."""

from models import Grade


def result(spec, verdict, reason, ids=()):
    return Grade(
        grader_id=spec.id, required=spec.required, verdict=verdict, reason=reason, evidence_ids=list(ids)
    )
